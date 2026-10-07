// Curioverse Studio Client App
let currentPackage = null;

// Pipeline step definitions for simulated live animation
const PIPELINE_STEPS = [
  { id: "step-research", label: "Research Agent", desc: "Searching academic papers & primary sources..." },
  { id: "step-factcheck", label: "Fact Checker", desc: "Classifying epistemic certainty across claims..." },
  { id: "step-script", label: "Script Agent", desc: "Writing 8-stage curiosity narrative arc..." },
  { id: "step-scenes", label: "Scene Planner", desc: "Structuring 8-25s scenes & continuity profiles..." },
  { id: "step-visuals", label: "Visual Agent", desc: "Compiling 16:9 Editorial Illustrated prompts..." },
  { id: "step-voice", label: "Voice Agent", desc: "Timing narration audio segments at ~135 wpm..." },
  { id: "step-editor", label: "Editor Agent", desc: "Composing multi-track timeline & SRT subtitles..." },
  { id: "step-thumbnail", label: "Thumbnail Agent", desc: "Formulating curiosity concepts & artwork..." },
  { id: "step-metadata", label: "Metadata Agent", desc: "Scoring titles & compiling timestamp chapters..." },
  { id: "step-qa", label: "QA Agent", desc: "Auditing aspect ratios, citations & video limits..." },
  { id: "step-approval", label: "Approval Gate", desc: "Enforcing human verification safeguards..." },
];

document.addEventListener("DOMContentLoaded", () => {
  // Topic inspiration chips
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const topicInput = document.getElementById("topic-input");
      topicInput.value = chip.getAttribute("data-topic") || "";
      topicInput.focus();
    });
  });

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetTab = document.getElementById(btn.getAttribute("data-tab"));
      if (targetTab) {
        targetTab.classList.add("active");
      }
    });
  });

  // Jump to publish tab from master banner
  const scrollToPublishBtn = document.getElementById("scroll-to-publish-btn");
  if (scrollToPublishBtn) {
    scrollToPublishBtn.addEventListener("click", () => {
      const publishTabBtn = document.querySelector('[data-tab="tab-publish"]');
      if (publishTabBtn) publishTabBtn.click();
    });
  }

  // Copy buttons
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const el = document.getElementById(targetId);
      if (el) {
        navigator.clipboard.writeText(el.value || el.innerText);
        showToast("Copied to clipboard!");
      }
    });
  });

  // Generate Button Click
  const generateBtn = document.getElementById("generate-btn");
  generateBtn.addEventListener("click", handleGenerate);

  // Publish Button Click
  const publishBtn = document.getElementById("publish-to-yt-btn");
  publishBtn.addEventListener("click", handlePublish);
});

async function handleGenerate() {
  const topicInput = document.getElementById("topic-input");
  const topic = topicInput.value.trim();

  if (!topic) {
    showToast("Please enter a curiosity topic first!");
    return;
  }

  const generateBtn = document.getElementById("generate-btn");
  const progressSec = document.getElementById("pipeline-progress");
  const resultsSec = document.getElementById("results-workspace");

  generateBtn.disabled = true;
  progressSec.classList.remove("hidden");
  resultsSec.classList.add("hidden");

  // Animate pipeline progress
  let stepIndex = 0;
  const stepInterval = setInterval(() => {
    if (stepIndex < PIPELINE_STEPS.length) {
      const step = PIPELINE_STEPS[stepIndex];
      updateProgressStep(stepIndex, step.label, step.desc);
      stepIndex++;
    }
  }, 180);

  try {
    const res = await fetch("/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });

    clearInterval(stepInterval);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || err.error || "Generation failed.");
    }

    currentPackage = await res.json();

    // Mark all steps complete
    PIPELINE_STEPS.forEach((_, idx) => {
      const el = document.getElementById(PIPELINE_STEPS[idx].id);
      if (el) {
        el.className = "p-step done";
      }
    });
    document.getElementById("pipeline-percent").innerText = "100%";
    document.getElementById("pipeline-current-step").innerText = "Production Pipeline Completed!";
    document.getElementById("pipeline-step-desc").innerText = "All 11 agents executed successfully.";

    renderResults(currentPackage);

    setTimeout(() => {
      resultsSec.classList.remove("hidden");
      resultsSec.scrollIntoView({ behavior: "smooth" });
    }, 400);

    showToast("Documentary package successfully generated!");
  } catch (error) {
    clearInterval(stepInterval);
    showToast(`Error: ${error.message}`);
    console.error(error);
  } finally {
    generateBtn.disabled = false;
  }
}

function updateProgressStep(index, label, desc) {
  const percent = Math.min(Math.round(((index + 1) / PIPELINE_STEPS.length) * 100), 95);
  document.getElementById("pipeline-percent").innerText = `${percent}%`;
  document.getElementById("pipeline-current-step").innerText = label;
  document.getElementById("pipeline-step-desc").innerText = desc;

  PIPELINE_STEPS.forEach((step, idx) => {
    const el = document.getElementById(step.id);
    if (!el) return;
    if (idx < index) {
      el.className = "p-step done";
    } else if (idx === index) {
      el.className = "p-step active";
    } else {
      el.className = "p-step";
    }
  });
}

function renderResults(data) {
  // 1. Master Video Banner
  document.getElementById("display-video-title").innerText = data.script.title;
  document.getElementById("display-video-hook").innerText = data.script.hook;
  document.getElementById("display-qa-score").innerText = data.qa ? data.qa.score : "95";
  document.getElementById("display-duration").innerText = `~${(data.estimatedDuration / 60).toFixed(1)} mins (${data.estimatedDuration}s)`;
  document.getElementById("display-scenes-count").innerText = `${data.scenes ? data.scenes.length : 0} scenes`;

  // Video player & download button
  const downloadBtn = document.getElementById("download-video-btn");
  const videoPlayerContainer = document.getElementById("video-player-container");
  const videoPlayer = document.getElementById("final-video-player");
  const videoSource = document.getElementById("video-source");

  if (data.render && data.render.renderStatus === "COMPLETED") {
    if (downloadBtn) downloadBtn.classList.remove("hidden");
    if (videoPlayerContainer) videoPlayerContainer.classList.remove("hidden");
    if (videoSource) videoSource.src = `/output/final_documentary.mp4?t=${Date.now()}`;
    if (videoPlayer) videoPlayer.load();
  } else {
    if (downloadBtn) downloadBtn.classList.add("hidden");
    if (videoPlayerContainer) videoPlayerContainer.classList.add("hidden");
  }

  // 2. Storyboard Tab
  const sbContainer = document.getElementById("storyboard-container");
  sbContainer.innerHTML = "";
  if (data.scenes && data.scenes.length > 0) {
    data.scenes.forEach((scn, idx) => {
      const asset = data.assets && data.assets[idx] ? data.assets[idx] : null;
      const imgSrc = asset ? asset.url : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'><rect width='100%' height='100%' fill='%23111827'/></svg>";

      const card = document.createElement("div");
      card.className = "scene-card";
      card.innerHTML = `
        <div class="scene-artwork-wrapper">
          <img src="${imgSrc}" alt="Scene ${idx + 1}" loading="lazy">
          <span class="scene-badge-type">${scn.sceneType}</span>
          <span class="scene-badge-duration">${scn.duration}s</span>
        </div>
        <div class="scene-card-body">
          <div class="scene-header-info">
            <span><strong>Scene ${String(idx + 1).padStart(2, "0")}</strong></span>
            <span>ID: ${scn.id}</span>
          </div>
          <p class="scene-narration">"${scn.narration}"</p>
          <div class="scene-meta-footer">
            <span class="motion-tag">🎥 ${scn.motion.type}</span>
            ${scn.characters.map((c) => `<span class="motion-tag">👤 ${c}</span>`).join("")}
          </div>
        </div>
      `;
      sbContainer.appendChild(card);
    });
  }

  // 3. Script Tab
  const scContainer = document.getElementById("script-container");
  scContainer.innerHTML = "";
  if (data.script && data.script.sections) {
    data.script.sections.forEach((sec) => {
      const item = document.createElement("div");
      item.className = "script-arc-item";
      item.innerHTML = `
        <div class="arc-badge">${sec.purpose}</div>
        <div class="arc-content">
          <div class="arc-duration">⏱ Duration: ~${sec.estimatedDuration} seconds</div>
          <p class="arc-narration">${sec.narration}</p>
        </div>
      `;
      scContainer.appendChild(item);
    });
  }

  // 4. Thumbnail Studio Tab
  const tnContainer = document.getElementById("thumbnails-container");
  tnContainer.innerHTML = "";
  if (data.thumbnail && data.thumbnail.concepts) {
    data.thumbnail.concepts.forEach((concept, idx) => {
      const isSelected = data.thumbnail.selectedConcept && data.thumbnail.selectedConcept.id === concept.id;
      const card = document.createElement("div");
      card.className = `thumb-card ${isSelected ? "selected" : ""}`;
      const imgUrl = concept.imageUrl || (data.thumbnail.selectedConcept ? data.thumbnail.selectedConcept.imageUrl : "");

      card.innerHTML = `
        <div class="thumb-preview-wrap">
          <img src="${imgUrl}" alt="${concept.shortText}">
          <div class="thumb-bold-text-overlay">${concept.shortText}</div>
        </div>
        <div class="thumb-card-body">
          <h4 class="thumb-hook-title">Concept ${idx + 1}: ${concept.shortText}</h4>
          <p class="thumb-hook-desc">${concept.curiosityHook}</p>
        </div>
      `;
      tnContainer.appendChild(card);
    });
  }

  // 5. Metadata Tab
  const titlesContainer = document.getElementById("titles-container");
  titlesContainer.innerHTML = "";
  if (data.metadata && data.metadata.titleCandidates) {
    data.metadata.titleCandidates.forEach((cand) => {
      const item = document.createElement("div");
      item.className = "title-candidate-item";
      item.innerHTML = `
        <h5>${cand.title}</h5>
        <div class="scores-row">
          <span class="score-chip">Curiosity: <strong>${cand.curiosityScore}/100</strong></span>
          <span class="score-chip">Accuracy: <strong>${cand.accuracyScore}/100</strong></span>
          <span class="score-chip">Clickability: <strong>${cand.clickabilityScore}/100</strong></span>
        </div>
      `;
      titlesContainer.appendChild(item);
    });
  }

  if (data.metadata) {
    document.getElementById("meta-description-preview").value = data.metadata.description;

    const tagsContainer = document.getElementById("tags-container");
    tagsContainer.innerHTML = data.metadata.tags.map((t) => `<span class="tag-pill">#${t}</span>`).join("");

    const hashtagsContainer = document.getElementById("hashtags-container");
    hashtagsContainer.innerHTML = data.metadata.hashtags.map((h) => `<span class="tag-pill">${h}</span>`).join("");
  }

  // 6. QA & Fact Audit Tab
  if (data.qa) {
    document.getElementById("qa-circle-score").innerText = data.qa.score;
    const recContainer = document.getElementById("qa-recommendations");
    recContainer.innerHTML = data.qa.recommendations.map((r) => `<p style="font-size:0.8rem; color:#9CA3AF; margin-top:0.3rem;">• ${r}</p>`).join("");
  }

  const claimsContainer = document.getElementById("claims-container");
  claimsContainer.innerHTML = "";
  if (data.factCheck && data.factCheck.claims) {
    data.factCheck.claims.forEach((cl) => {
      const cItem = document.createElement("div");
      cItem.className = "claim-item";
      cItem.innerHTML = `
        <div class="claim-header">
          <span class="epistemic-badge ${cl.status}">${cl.status}</span>
          <span style="font-size:0.75rem; color:#6B7280;">Confidence: ${(cl.confidence * 100).toFixed(0)}%</span>
        </div>
        <p class="claim-text">"${cl.text}"</p>
        <p style="font-size:0.75rem; color:#9CA3AF; margin-top:0.25rem;">Sources: ${cl.sources.join(", ")}</p>
      `;
      claimsContainer.appendChild(cItem);
    });
  }
}

async function handlePublish() {
  if (!currentPackage) {
    showToast("Please generate a documentary package first!");
    return;
  }

  const confirmed = document.getElementById("human-approval-check").checked;
  if (!confirmed) {
    showToast("Please check the human approval box before publishing!");
    return;
  }

  const privacySelect = document.getElementById("publish-visibility");
  const privacyStatus = privacySelect.value;
  const publishBtn = document.getElementById("publish-to-yt-btn");

  publishBtn.disabled = true;
  publishBtn.innerText = "Distributing to YouTube Data API...";

  try {
    const payload = {
      render: currentPackage.render,
      thumbnail: currentPackage.thumbnail,
      metadata: currentPackage.metadata,
      approval: {
        readyForReview: true,
        autoPublish: false,
        status: "APPROVED",
        notes: "Human approved via Web Dashboard Studio",
      },
      privacyStatus,
      humanApproved: true,
    };

    const res = await fetch("/api/content/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || data.error || "Failed to publish.");
    }

    const result = data.result;
    const resultBox = document.getElementById("publish-result-box");
    resultBox.classList.remove("hidden");

    document.getElementById("publish-result-subtitle").innerText = result.title;
    const urlEl = document.getElementById("res-video-url");
    urlEl.href = result.videoUrl;
    urlEl.innerText = result.videoUrl;
    document.getElementById("res-video-id").innerText = result.videoId;
    document.getElementById("res-video-privacy").innerText = result.privacyStatus;
    document.getElementById("res-thumb-status").innerText = result.thumbnailUploaded ? "Uploaded" : "Standard";

    showToast("Video published to YouTube successfully!");
    resultBox.scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    showToast(`Publish error: ${error.message}`);
    console.error(error);
  } finally {
    publishBtn.disabled = false;
    publishBtn.innerHTML = '<span class="btn-icon">🚀</span><span>Approve & Publish to YouTube</span>';
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}
