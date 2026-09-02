(() => {
  // Job screening rules loaded from screening-rules.json. Matching is case-insensitive.

  let RULES = { red: [], yellow: [], green: [] };

  async function loadRules() {
    try {
      const response = await fetch(chrome.runtime.getURL("screening-rules.json"));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      RULES = {
        red: Array.isArray(data.red) ? data.red : [],
        yellow: Array.isArray(data.yellow) ? data.yellow : [],
        green: Array.isArray(data.green) ? data.green : []
      };
      update();
    } catch (error) {
      console.error("LinkedIn Job Screener: failed to load screening-rules.json", error);
      RULES = { red: [], yellow: [], green: [] };
      update();
    }
  }

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
    const containerText = container
      ? (container.innerText || "").replace(/\s+/g, " ").trim()
      : "";

    if (containerText) return containerText;

    const bodyText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    return bodyText.length > 120 ? bodyText : "";
  }

  function normalizeText(value) {
    return (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(word => {
        if (word.length <= 3) return word;
        if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
        if (word.endsWith("sses")) return word.slice(0, -2);
        if (word.endsWith("es") && !word.endsWith("se")) return word.slice(0, -2);
        if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
        return word;
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findMatches(text, rules) {
    const normalizedText = normalizeText(text);

    return rules.filter(rule => {
      const normalizedRule = normalizeText(rule);
      return !normalizedRule || normalizedText.includes(normalizedRule);
    });
  }

  function analyze(text) {
    const red = findMatches(text, RULES.red);
    const yellow = findMatches(text, RULES.yellow);
    const green = findMatches(text, RULES.green);

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
        : "Apply to this role and open another role to scan its details"
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
    timer = setTimeout(update, 350);
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

  loadRules();

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
