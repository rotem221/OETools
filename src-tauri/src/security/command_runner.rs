use crate::core::errors::CommandError;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

/// Result of running an external tool.
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

/// Safely run an external binary with structured arguments.
///
/// SECURITY: We never invoke a shell. Arguments are passed as a discrete
/// vector so there is no opportunity for shell injection. The binary is
/// looked up on PATH via `which` by the dependency manager; callers pass the
/// resolved program name.
pub fn run(program: &str, args: &[&str], timeout: Duration) -> Result<CommandOutput, CommandError> {
    // Basic guard: program name must not contain path separators unless it is
    // an absolute resolved path from the dependency manager.
    if program.is_empty() {
        return Err(CommandError::internal("empty program name"));
    }

    let child = Command::new(program)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();

    let mut child = match child {
        Ok(c) => c,
        Err(e) => {
            return Err(CommandError::new(format!("Failed to start \"{program}\"."))
                .with_details(e.to_string()))
        }
    };

    // Simple timeout using a polling wait.
    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => break,
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return Err(CommandError::command_timed_out(program));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(CommandError::internal(e.to_string())),
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| CommandError::internal(e.to_string()))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
    })
}

/// Outcome of a streaming run.
pub enum StreamResult {
    /// The process exited on its own; carries whether it exited successfully.
    Exited(bool),
    /// The process was stopped because the cancel flag was set.
    Cancelled,
    /// The process exceeded the timeout and was killed.
    TimedOut,
}

/// Run an external binary and stream its stdout/stderr to `on_line` as lines
/// arrive, so the UI can reflect real progress. Splits on both `\n` and `\r`
/// (progress bars often overwrite a line with carriage returns). Honors a
/// cancel flag (kills the child) and an overall timeout.
///
/// SECURITY: identical guarantees to [`run`] — no shell is involved.
pub fn run_streaming(
    program: &str,
    args: &[&str],
    timeout: Duration,
    cancel: &AtomicBool,
    mut on_line: impl FnMut(&str),
) -> Result<StreamResult, CommandError> {
    use std::io::Read;
    use std::sync::mpsc;

    if program.is_empty() {
        return Err(CommandError::internal("empty program name"));
    }

    let mut child = Command::new(program)
        .args(args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            CommandError::new(format!("Failed to start \"{program}\".")).with_details(e.to_string())
        })?;

    let (tx, rx) = mpsc::channel::<String>();

    // One reader thread per stream. Each emits complete lines (split on \n/\r).
    let spawn_reader = |mut stream: Option<Box<dyn Read + Send>>, tx: mpsc::Sender<String>| {
        std::thread::spawn(move || {
            let Some(stream) = stream.take() else { return };
            let mut reader = stream;
            let mut buf: Vec<u8> = Vec::with_capacity(256);
            let mut byte = [0u8; 1];
            loop {
                match reader.read(&mut byte) {
                    Ok(0) => break,
                    Ok(_) => {
                        if byte[0] == b'\n' || byte[0] == b'\r' {
                            if !buf.is_empty() {
                                let line = String::from_utf8_lossy(&buf).trim().to_string();
                                buf.clear();
                                if !line.is_empty() && tx.send(line).is_err() {
                                    break;
                                }
                            }
                        } else {
                            buf.push(byte[0]);
                        }
                    }
                    Err(_) => break,
                }
            }
            if !buf.is_empty() {
                let line = String::from_utf8_lossy(&buf).trim().to_string();
                if !line.is_empty() {
                    let _ = tx.send(line);
                }
            }
        });
    };

    if let Some(out) = child.stdout.take() {
        spawn_reader(Some(Box::new(out)), tx.clone());
    }
    if let Some(err) = child.stderr.take() {
        spawn_reader(Some(Box::new(err)), tx.clone());
    }
    drop(tx);

    let start = std::time::Instant::now();
    let outcome;

    loop {
        while let Ok(line) = rx.try_recv() {
            on_line(&line);
        }

        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            outcome = StreamResult::Cancelled;
            break;
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                outcome = StreamResult::Exited(status.success());
                break;
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    outcome = StreamResult::TimedOut;
                    break;
                }
                std::thread::sleep(Duration::from_millis(60));
            }
            Err(e) => return Err(CommandError::internal(e.to_string())),
        }
    }

    // Drain any remaining buffered lines after the process ends.
    let _ = child.wait();
    while let Ok(line) = rx.recv_timeout(Duration::from_millis(50)) {
        on_line(&line);
    }

    Ok(outcome)
}

/// Run an external binary feeding `input` to its stdin. Used for tools with an
/// interactive/REPL mode (e.g. `afcclient`) so many operations run over a
/// single device connection instead of spawning one process per operation.
///
/// SECURITY: identical guarantees to [`run`] — no shell is involved.
pub fn run_with_stdin(
    program: &str,
    args: &[&str],
    input: &str,
    timeout: Duration,
) -> Result<CommandOutput, CommandError> {
    use std::io::Write;

    if program.is_empty() {
        return Err(CommandError::internal("empty program name"));
    }

    let child = Command::new(program)
        .args(args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn();

    let mut child = match child {
        Ok(c) => c,
        Err(e) => {
            return Err(CommandError::new(format!("Failed to start \"{program}\"."))
                .with_details(e.to_string()))
        }
    };

    // Write the commands on a separate thread so a large input buffer cannot
    // deadlock against the child's stdout that we drain later.
    if let Some(mut stdin) = child.stdin.take() {
        let data = input.to_string();
        std::thread::spawn(move || {
            let _ = stdin.write_all(data.as_bytes());
            // Dropping `stdin` closes the pipe, signalling EOF to the child.
        });
    }

    let start = std::time::Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => break,
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return Err(CommandError::command_timed_out(program));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(CommandError::internal(e.to_string())),
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| CommandError::internal(e.to_string()))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        success: output.status.success(),
    })
}
