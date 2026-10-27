use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(serde::Serialize)]
struct SaveResult {
    path: String,
}

fn sanitize_filename(input: &str) -> String {
    let mut cleaned: String = input
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect();

    cleaned = cleaned.trim_matches(|character| character == '-' || character == '.').to_string();
    if cleaned.is_empty() {
        cleaned = "ridecast-route".to_string();
    }
    if !cleaned.to_ascii_lowercase().ends_with(".gpx") {
        cleaned.push_str(".gpx");
    }

    cleaned
}

fn unique_path(directory: &Path, filename: &str) -> PathBuf {
    let candidate = directory.join(filename);
    if !candidate.exists() {
        return candidate;
    }

    let stem = candidate
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("ridecast-route");
    let extension = candidate
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("gpx");

    for index in 2..10_000 {
        let next = directory.join(format!("{stem}-{index}.{extension}"));
        if !next.exists() {
            return next;
        }
    }

    directory.join(format!("{stem}-{}.{extension}", std::process::id()))
}

/// Writes a GPX file into the user's Downloads folder and returns its path.
///
/// Keeping this in Rust means the desktop app never has to fake a browser
/// download inside WKWebView, and no filesystem plugin permissions are needed.
#[tauri::command]
fn save_gpx(app: tauri::AppHandle, filename: String, contents: String) -> Result<SaveResult, String> {
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|error| format!("Couldn't locate the Downloads folder: {error}"))?;

    fs::create_dir_all(&download_dir)
        .map_err(|error| format!("Couldn't create the Downloads folder: {error}"))?;

    let target = unique_path(&download_dir, &sanitize_filename(&filename));
    fs::write(&target, contents).map_err(|error| format!("Couldn't write the GPX file: {error}"))?;

    Ok(SaveResult {
        path: target.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .status()
            .map_err(|error| format!("Couldn't open Finder: {error}"))?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err("Reveal in Finder is only available on macOS.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_gpx, reveal_in_finder])
        .run(tauri::generate_context!())
        .expect("error while running RideCast");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_file_names() {
        assert_eq!(sanitize_filename("ride.gpx"), "ride.gpx");
        assert_eq!(sanitize_filename("Ride 2026/10/27"), "Ride-2026-10-27.gpx");
        assert_eq!(sanitize_filename("../../evil"), "evil.gpx");
        assert_eq!(sanitize_filename(""), "ridecast-route.gpx");
        assert_eq!(sanitize_filename(".gpx"), "gpx.gpx");
    }

    #[test]
    fn makes_duplicate_names_unique() {
        let directory = std::env::temp_dir().join(format!("ridecast-test-{}", std::process::id()));
        fs::create_dir_all(&directory).expect("create temp directory");

        let first = unique_path(&directory, "route.gpx");
        fs::write(&first, "test").expect("write file");
        let second = unique_path(&directory, "route.gpx");

        assert_eq!(first.file_name().and_then(|name| name.to_str()), Some("route.gpx"));
        assert_eq!(
            second.file_name().and_then(|name| name.to_str()),
            Some("route-2.gpx")
        );

        fs::remove_dir_all(&directory).expect("clean temp directory");
    }
}
