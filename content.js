(() => {
  // Job screening rules. Matching is case-insensitive.

  const RED_RULES = [
    // Security clearance
    "security clearance",
    "clearance required",
    "active secret clearance",
    "active top secret clearance",
    "secret clearance",
    "top secret clearance",
    "TS/SCI",
    "TS-SCI",
    "SCI clearance",
    "DoD clearance",
    "Department of Defense",

    // Citizenship
    "must be a US citizen",
    "must be a U.S. citizen",
    "US citizenship required",
    "U.S. citizenship required",
    "citizenship requirement",

    // No sponsorship
    "will not sponsor",
    "won't sponsor",
    "no sponsorship",
    "unable to sponsor",
    "not able to sponsor",
    "visa sponsorship is not available",
    "sponsorship is not available",
    "without sponsorship"
  ];

  const YELLOW_RULES = [
    // Work authorization / immigration
    "work authorization",
    "authorized to work",
    "legally authorized to work",
    "employment authorization",
    "visa",
    "sponsorship",
    "immigration",
    "government",

    // Consultancy / staffing
    "consulting",
    "consultancy",
    "consultant",
    "staffing",
    "staffing agency",
    "staffing & recruiting",
    "staffing and recruiting",
    "recruiting agency",
    "recruitment agency",
    "contract staffing",
    "professional services"
  ];

  const GREEN_RULES = [
    "visa sponsorship is available",
    "sponsorship is available",
    "will sponsor",
    "H-1B sponsorship",
    "H1B sponsorship",
    "H-1B visa sponsorship"
  ];

  let lastUrl = location.href;
  let timer;
  let lastMatches = { red: [], yellow: [], green: [] };

  const JOB_DETAIL_SELECTORS = [
    ".jobs-search__job-details--container",
    ".jobs-search__job-details",
    '[data-view-name="job-detail"]',
    '[class*="jobs-search__job-details"]',
    '[data-job-details]',
    "section.jobs-details"
  ];

  function isVisible(element) {
    if (!element || element.id === "lj-status-dot" || element.id === "lj-status-panel") {
      return false;
    }

    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.position !== "fixed" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function getJobDetailContainer() {
    for (const selector of JOB_DETAIL_SELECTORS) {
      const matches = document.querySelectorAll(selector);
      for (const element of matches) {
        if (isVisible(element) && element.innerText?.trim()) {
          return element;
        }
      }
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightSide = viewportWidth * 0.32;

    const candidates = [];
    const roots = document.querySelectorAll("main, [role='main']");
    const elements = [];

    for (const root of roots) {
      elements.push(root, ...root.querySelectorAll("*"));
    }

    const headings = elements.filter(element => {
      if (!isVisible(element)) return false;
      const rect = element.getBoundingClientRect();
      const text = (element.innerText || "").trim();
      return (
        rect.left >= rightSide &&
        rect.top >= 120 &&
        rect.top < viewportHeight * 0.65 &&
        text.length >= 5 &&
        text.length <= 180 &&
        /^(h1|h2|h3)$/i.test(element.tagName)
      );
    });

    for (const heading of headings) {
      let ancestor = heading.parentElement;
      for (let level = 0; ancestor && level < 10; level++, ancestor = ancestor.parentElement) {
        if (!isVisible(ancestor)) continue;

        const rect = ancestor.getBoundingClientRect();
        const text = (ancestor.innerText || "").trim();

        if (
          rect.left >= rightSide * 0.85 &&
          rect.width >= viewportWidth * 0.38 &&
          rect.height >= Math.min(260, viewportHeight * 0.35) &&
          text.length >= 200
        ) {
          return ancestor;
        }
      }
    }

    for (const element of elements) {
      if (!isVisible(element)) continue;

      const rect = element.getBoundingClientRect();
      const text = (element.innerText || "").trim();

      if (
        rect.left >= rightSide * 0.85 &&
        rect.top >= 120 &&
        rect.top < viewportHeight * 0.65 &&
        rect.width >= viewportWidth * 0.38 &&
        rect.height >= Math.min(260, viewportHeight * 0.45) &&
        text.length >= 200
      ) {
        candidates.push({ element, rect, textLength: text.length });
      }
    }

    candidates.sort((a, b) => {
      const score = item =>
        (item.rect.width * item.rect.height) +
        Math.min(item.textLength, 12000) * 2 -
        item.rect.top * 100;

      return score(b) - score(a);
    });

    return candidates[0]?.element || null;
  }

  function getJobDetailText() {
    const container = getJobDetailContainer();
    return container
      ? (container.innerText || "").replace(/\s+/g, " ").trim()
      : "";
  }

  function findMatches(text, rules) {
    return rules.filter(rule =>
      text.toLowerCase().includes(rule.toLowerCase())
    );
  }

  function analyze(text) {
    const red = findMatches(text, RED_RULES);
    const yellow = findMatches(text, YELLOW_RULES);
    const green = findMatches(text, GREEN_RULES);

    lastMatches = { red, yellow, green };

    if (red.length) return "red";
    if (green.length) return "green";
    if (yellow.length) return "yellow";
    return "green";
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function ensureUI() {
    let dot = document.getElementById("lj-status-dot");
    let panel = document.getElementById("lj-status-panel");

    if (!dot) {
      dot = document.createElement("div");
      dot.id = "lj-status-dot";
      dot.setAttribute("aria-label", "LinkedIn job screening status");
      document.documentElement.appendChild(dot);

      dot.addEventListener("click", event => {
        event.stopPropagation();
        const p = document.getElementById("lj-status-panel");
        if (p) {
          p.hidden = !p.hidden;
          if (!p.hidden) renderPanel();
        }
      });
    }

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "lj-status-panel";
      panel.hidden = true;
      document.documentElement.appendChild(panel);
    }

    return { dot, panel };
  }

  function renderPanel() {
    const { panel } = ensureUI();

    const sections = [
      ["red", "Red", lastMatches.red],
      ["yellow", "Yellow", lastMatches.yellow],
      ["green", "Green", lastMatches.green]
    ];

    const found = sections
      .filter(([, , items]) => items.length)
      .map(([key, title, items]) => `
        <div class="lj-section lj-${key}">
          <div class="lj-section-title">${title}</div>
          ${items.map(item =>
            `<div class="lj-match">${escapeHtml(item)}</div>`
          ).join("")}
        </div>
      `).join("");

    panel.innerHTML = found || `<div class="lj-none">${
      getJobDetailContainer()
        ? "Nothing found"
        : "Open a job to scan its details"
    }</div>`;
  }

  function update() {
    const { dot } = ensureUI();
    dot.dataset.scanning = "true";
    dot.title = "Scanning opened job…";

    const text = getJobDetailText();
    const status = analyze(text);

    dot.dataset.status = status;
    dot.dataset.scanning = "false";
    dot.title =
      status === "red" ? "Job status: red" :
      status === "yellow" ? "Job status: yellow" :
      "Job status: green";

    const panel = document.getElementById("lj-status-panel");
    if (panel && !panel.hidden) renderPanel();
  }

  function scheduleUpdate() {
    clearTimeout(timer);
    const { dot } = ensureUI();
    dot.dataset.scanning = "true";
    dot.title = "Scanning…";
    timer = setTimeout(update, 450);
  }

  document.addEventListener("click", event => {
    const dot = document.getElementById("lj-status-dot");
    const panel = document.getElementById("lj-status-panel");

    if (
      panel &&
      !panel.hidden &&
      event.target !== dot &&
      !panel.contains(event.target)
    ) {
      panel.hidden = true;
    }
  }, true);

  update();

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleUpdate();
    }
  }, 500);
})();
