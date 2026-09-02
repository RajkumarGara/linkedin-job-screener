# LinkedIn Job Screener

A lightweight, local-first Chrome Extension (Manifest V3) that automatically screens LinkedIn job postings for key eligibility signals—such as visa sponsorship, citizenship requirements, and security clearances—displaying an instant color-coded status dot.

---

## 🎨 How It Works

The extension continuously monitors the currently opened job description on LinkedIn and categorizes it using simple, customizable rule sets:

* 🟢 **GREEN:** Visa sponsorship is explicitly available, or no restricted keywords were detected.
* 🟡 **YELLOW:** Flags ambiguous work authorization terminology or staffing/recruiting agency postings.
* 🔴 **RED:** Hard requirements detected, such as active security clearance, strict U.S. citizenship requirements, or explicit "no sponsorship" policies.

Clicking the status dot opens a floating panel detailing the exact keyword rules matched in the current job listing.

---

## ✨ Features

* **Real-time Scanning:** Automatically re-scans whenever you navigate to a new job listing on LinkedIn.
* **Visual Progress:** Features an animated scanning indicator while processing new job details.
* **Interactive Breakdown:** Toggle the panel to inspect exact matched terms across Red, Yellow, and Green categories.
* **100% Private & Local:** No external API calls, tracking scripts, backend servers, or data collection.
* **Easy Customization:** Edit phrase rules directly in plain JavaScript.

---

## 📁 Repository Structure

```text
├── manifest.json         # Chrome Extension Manifest V3 configuration
├── content.js            # Core logic for DOM parsing, keyword matching, and UI rendering
├── screening-rules.json  # Red, yellow, and green screening keyword lists
├── style.css             # Styles for the status dot and detailed overlay panel
└── README.md             # Project documentation
```

---

## 🚀 Installation

Since this extension runs entirely locally, install it in Chrome via Developer Mode:

1. **Clone or Download** this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the repository directory containing `manifest.json`.
6. Navigate to [LinkedIn Jobs](https://www.linkedin.com/jobs/) or refresh any existing tab to see it in action!

---

## ⚙️ Customizing Screening Rules

You can easily adjust or expand the search rules to fit your personal job hunt constraints:

1. Open [screening-rules.json](screening-rules.json) in your code editor.
2. Edit the `red`, `yellow`, or `green` arrays with any phrase entries you want to match (matching is case-insensitive).
3. Go to `chrome://extensions` and click the **Reload (↻)** button on the extension card to apply your changes.

---

## 📄 License

MIT License. Free to use, modify, and distribute.
