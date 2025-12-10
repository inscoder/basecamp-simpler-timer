# Basecamp Simple Timer

A Chrome Extension designed to track time on Basecamp that functions as a stopwatch.

## 🚀 Key Features

* One-Click Start: Click `+ Start Timer` to immediately begin tracking the current page.

* Auto-Switching: Starting a new task automatically pauses any other running task. Only one timer runs at a time.

* Persistent Storage: Timers rely on timestamps saved in local storage, so they survive browser crashes and restarts without losing time.

* Decimal Conversion: Automatically converts time to decimal hours (e.g., `1h 15m` -> `1.25`) for easy entry into Basecamp timesheets.

* Click-to-Copy: Click the decimal number to copy it to your clipboard.

* Privacy Focused: Uses `activeTab` permission only. Does not scan your background tabs or history.

## 🛠 Supported Page Types

The extension strictly validates URLs to ensure you only track time on actionable work items. It supports:

* Todos (`/todos/`)

* Cards (`/cards/`)

* Projects (`/projects/`)

* Messages (`/messages/`)

* Documents (`/documents/`)

* Schedule Entries (`/schedule_entries/`)

## 📦 Installation

Since this is a custom internal tool, you will install it as an "Unpacked Extension" in Chrome.

1. Download/Clone this repository to a folder on your computer (e.g., basecamp_timer_v1).

2. Open Google Chrome and navigate to chrome://extensions.

3. Enable Developer mode using the toggle switch in the top-right corner.

4. Click the Load unpacked button in the top-left corner.

5. Select the folder containing the source code.

6. (Optional) Click the Puzzle Piece icon in the Chrome toolbar and Pin the extension for easy access.

## 📖 How to Use

### Workflow: Start, Stop, & Log

1. Navigate to a Basecamp To-do, Card, or any other page that supports time tracking.

2. Click the Extension icon.

3. Click the `+ Start Timer` button.

   * If the task is new: It is added to the list and starts running immediately.

   * If the task exists: It resumes the existing timer.

   * Note: Any other running timer will be automatically paused.

4. Stop the Timer: When you finish the task or take a break, click the Pause (⏸) icon next to the task.

5. Log Time Manually:

   * This extension serves strictly as a stopwatch; you must enter the time into Basecamp yourself.

   * Click the decimal number (e.g., (`1.25`)) in the extension to copy the value to your clipboard.

   * Paste the value into the Basecamp Timesheet form.

### Managing Tasks

* Pause/Resume: Click the Play (▶) or Pause (⏸) icon next to any item.

* Navigate: Click the Task Title to open that specific Basecamp page in your current tab.

  * Smart Nav: If you are already on that page, it simply reloads to prevent "Back Button" history traps.

* Copy Time: Click the decimal number (e.g., (`1.25`)) to copy it to your clipboard.

* Delete: Click the Trash icon (🗑) to remove a timer from the list.

## 🚫 Out of Scope: Why No Auto-Fill?

You might wonder why the extension doesn't automatically fill in the Basecamp timesheet form for you.

We intentionally excluded this feature for stability. Basecamp frequently updates their user interface code (HTML/CSS). If this extension attempted to find and fill specific input fields programmatically, it would likely break every time Basecamp pushed an update. By keeping this tool as a focused, "Read-Only" stopwatch, we ensure it remains robust, maintenance-free, and reliable regardless of Basecamp's visual changes.

## 📂 Project Structure

```
basecamp_timer/
├── manifest.json      # Extension configuration and permissions
├── background.js      # Core logic (Timer math, URL parsing, Auto-switching)
├── popup.html         # The interface structure
├── popup.css          # Styling (Visual indicators, FLIP animations)
├── popup.js           # UI Logic (Rendering list, 1-second visual ticker)
└── icons/             # Application icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🔒 Permissions Explained

* `storage`: Used to save your task list and start times locally on your machine.

* `activeTab`: Grants temporary access to the URL and Title of the current tab when you interact with the extension. This ensures the extension cannot see your browsing history or data on other tabs.


