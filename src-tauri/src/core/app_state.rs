use crate::core::dependency_manager;
use crate::database::repositories::settings as settings_repo;
use crate::database::Database;
use crate::device_bridge::Bridge;
use crate::models::DependencyInfo;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Dependency probing spawns several `--version` subprocesses, so results are
/// cached for this long. Device polling reuses the cache instead of re-probing
/// on every call, which is what previously made the app feel heavy/stuck.
const DEP_CACHE_TTL: Duration = Duration::from_secs(60);

/// Global application state shared with all Tauri commands.
pub struct AppState {
    pub db: Arc<Database>,
    /// Per-job cancellation flags for long-running operations.
    pub cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
    /// Cached dependency probe: (checked_at, results).
    dep_cache: Mutex<Option<(Instant, Vec<DependencyInfo>)>>,
}

impl AppState {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            db,
            cancel_flags: Mutex::new(HashMap::new()),
            dep_cache: Mutex::new(None),
        }
    }

    /// Return dependency probe results, using the cache unless `force` is set
    /// or the cache has expired. `force` is used by the explicit "Dependencies"
    /// re-check action so the UI always reflects the current environment.
    pub fn dependencies(&self, force: bool) -> Vec<DependencyInfo> {
        {
            let cache = self.dep_cache.lock().unwrap();
            if !force {
                if let Some((at, deps)) = cache.as_ref() {
                    if at.elapsed() < DEP_CACHE_TTL {
                        return deps.clone();
                    }
                }
            }
        }
        let deps = dependency_manager::check_all();
        *self.dep_cache.lock().unwrap() = Some((Instant::now(), deps.clone()));
        deps
    }

    /// Build a device bridge honoring the current mock-mode setting and the
    /// availability of the required tools. Falls back to mock automatically
    /// when core tools are missing, so the app is always functional.
    pub fn bridge(&self) -> Bridge {
        let conn = self.db.conn.lock().unwrap();
        let settings = settings_repo::get(&conn);
        drop(conn);

        if settings.mock_mode {
            return Bridge::new(true);
        }
        let deps = self.dependencies(false);
        Bridge::new(!dependency_manager::core_tools_present(&deps))
    }

    pub fn register_cancel(&self, job_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.cancel_flags
            .lock()
            .unwrap()
            .insert(job_id.to_string(), flag.clone());
        flag
    }

    pub fn request_cancel(&self, job_id: &str) {
        if let Some(flag) = self.cancel_flags.lock().unwrap().get(job_id) {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }

    pub fn clear_cancel(&self, job_id: &str) {
        self.cancel_flags.lock().unwrap().remove(job_id);
    }
}
