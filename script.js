
"use strict";

// FITTS' LAW EXPERIMENT
// 4 sizes x 4 distances x 2 directions = 32 tasks
// 10 randomized blocks = 320 trials per participant

const DIAMETERS = [30, 50, 70, 90];
const DISTANCES = [120, 180, 240, 300];
const DIRECTIONS = ["left", "right"];
const TOTAL_BLOCKS = 10;
const TRIALS_PER_BLOCK = 32;
const TOTAL_TRIALS = TOTAL_BLOCKS * TRIALS_PER_BLOCK;

const $ = (id) => document.getElementById(id);

const welcomeScreen = $("welcomeScreen");
const experimentScreen = $("experimentScreen");
const completionScreen = $("completionScreen");
const experimentArea = $("experimentArea");
const startPoint = $("startPoint");
const targetCircle = $("targetCircle");
const progress = $("progress");
const feedback = $("feedback");

let participantID = "";
let consentTime = "";
let trials = [];
let results = [];
let trialIndex = 0;

let state = "welcome";
let startTime = 0;
let lastPosition = null;
let pathDistance = 0;
let errors = 0;
let nextTimer = null;
let runCompleted = false;

// Randomize a block of tasks
function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

// Create 32 unique combinations for every block
function generateTrials() {
    const allTrials = [];

    for (let block = 1; block <= TOTAL_BLOCKS; block++) {
        const blockTrials = [];

        for (const diameter of DIAMETERS) {
            for (const distance of DISTANCES) {
                for (const direction of DIRECTIONS) {
                    blockTrials.push({
                        block,
                        diameter,
                        distance,
                        direction
                    });
                }
            }
        }

        allTrials.push(...shuffle(blockTrials));
    }

    return allTrials;
}

// Check that the experiment design is correct
function validateTrialDesign() {
    if (trials.length !== TOTAL_TRIALS) {
        return false;
    }

    for (let block = 1; block <= TOTAL_BLOCKS; block++) {
        const blockTrials = trials.filter(
            trial => trial.block === block
        );

        const unique = new Set(
            blockTrials.map(trial =>
                `${trial.diameter}-${trial.distance}-${trial.direction}`
            )
        );

        if (
            blockTrials.length !== TRIALS_PER_BLOCK ||
            unique.size !== TRIALS_PER_BLOCK
        ) {
            return false;
        }
    }

    return true;
}

// Ensure every target fits on the screen
function targetsFit() {
    const halfWidth = experimentArea.clientWidth / 2;
    const maxDistance = Math.max(...DISTANCES);
    const maxRadius = Math.max(...DIAMETERS) / 2;

    return (
        halfWidth >= maxDistance + maxRadius + 5 &&
        experimentArea.clientHeight >=
            Math.max(...DIAMETERS) + 10
    );
}

// Start after participant gives consent
$("startButton").addEventListener("click", () => {
    const id = $("participantID").value.trim();

    if (
        !id ||
        !$("ageConfirm").checked ||
        !$("consentCheckbox").checked
    ) {
        alert(
            "Please enter a participant ID, confirm " +
            "your age, and agree to participate."
        );
        return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        alert("Use letters, numbers, hyphens or underscores.");
        return;
    }

    welcomeScreen.hidden = true;
    experimentScreen.hidden = false;

    if (!targetsFit()) {
        experimentScreen.hidden = true;
        welcomeScreen.hidden = false;

        alert(
            "The testing area is too small. " +
            "Maximize the browser window and try again."
        );
        return;
    }

    participantID = id;
    consentTime = new Date().toISOString();

    trials = generateTrials();

    if (!validateTrialDesign()) {
        alert("Trial design validation failed.");
        experimentScreen.hidden = true;
        welcomeScreen.hidden = false;
        return;
    }

    results = [];
    trialIndex = 0;
    runCompleted = false;

    prepareTrial();
});

// Set up the next trial
function prepareTrial() {
    clearTimeout(nextTimer);
    nextTimer = null;

    if (trialIndex >= TOTAL_TRIALS) {
        finishExperiment();
        return;
    }

    if (!targetsFit()) {
        state = "paused";
        targetCircle.style.display = "none";
        feedback.textContent =
            "Window too small. Maximize it to continue.";
        return;
    }

    const trial = trials[trialIndex];

    state = "ready";
    pathDistance = 0;
    errors = 0;
    lastPosition = null;

    targetCircle.style.display = "none";

    progress.textContent =
        `Block ${trial.block} of ${TOTAL_BLOCKS} | ` +
        `Trial ${(trialIndex % TRIALS_PER_BLOCK) + 1} ` +
        `of ${TRIALS_PER_BLOCK} | ` +
        `Overall ${trialIndex + 1} of ${TOTAL_TRIALS}`;

    feedback.textContent =
        "Click the blue center point to begin.";

    feedback.style.color = "#234b80";
}

// Show target using center-to-center distance
function showTarget() {
    const trial = trials[trialIndex];

    const centerX = experimentArea.clientWidth / 2;
    const centerY = experimentArea.clientHeight / 2;

    const targetCenterX =
        centerX +
        (trial.direction === "right"
            ? trial.distance
            : -trial.distance);

    const radius = trial.diameter / 2;

    targetCircle.style.width = `${trial.diameter}px`;
    targetCircle.style.height = `${trial.diameter}px`;

    targetCircle.style.left =
        `${targetCenterX - radius}px`;

    targetCircle.style.top =
        `${centerY - radius}px`;

    targetCircle.style.display = "block";
}

// Start trial at center
startPoint.addEventListener("click", (event) => {
    if (state !== "ready") return;

    event.stopPropagation();

    const rect = experimentArea.getBoundingClientRect();

    lastPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };

    pathDistance = 0;
    errors = 0;

    showTarget();

    startTime = performance.now();
    state = "active";

    feedback.textContent =
        "Click the green circle as quickly as possible!";
});

// Track mouse movement throughout the document
document.addEventListener("pointermove", (event) => {
    if (state !== "active") return;

    const rect = experimentArea.getBoundingClientRect();

    const current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };

    if (lastPosition) {
        const dx = current.x - lastPosition.x;
        const dy = current.y - lastPosition.y;

        pathDistance += Math.hypot(dx, dy);
    }

    lastPosition = current;
});

// Count missed clicks inside the testing area
experimentArea.addEventListener("click", (event) => {
    if (state !== "active") return;

    if (event.target !== targetCircle) {
        errors++;

        feedback.textContent =
            `Missed clicks: ${errors}. Try again.`;

        feedback.style.color = "#c0392b";
    }
});

// Complete trial after a successful target click
targetCircle.addEventListener("click", (event) => {
    if (state !== "active") return;

    event.stopPropagation();

    const elapsed = performance.now() - startTime;
    const trial = trials[trialIndex];

    const indexOfDifficulty =
        Math.log2(1 + trial.distance / trial.diameter);

    state = "feedback";

    results.push({
        participantID,
        consentGiven: true,
        consentTime,
        block: trial.block,
        trial: (trialIndex % TRIALS_PER_BLOCK) + 1,
        overallTrial: trialIndex + 1,
        diameterPx: trial.diameter,
        distancePx: trial.distance,
        direction: trial.direction,
        indexOfDifficulty:
            Number(indexOfDifficulty.toFixed(5)),
        completionTimeMs:
            Number(elapsed.toFixed(2)),
        actualDistancePx:
            Number(pathDistance.toFixed(2)),
        errors
    });

    feedback.textContent =
        `Completed in ${elapsed.toFixed(0)} ms. ` +
        `Missed clicks: ${errors}`;

    feedback.style.color = "#16702e";
    targetCircle.style.display = "none";

    trialIndex++;

    nextTimer = setTimeout(prepareTrial, 500);
});

// Invalidate an active trial if focus is lost
function interruptTrial() {
    if (state !== "active") return;

    state = "interrupted";
    targetCircle.style.display = "none";

    feedback.textContent =
        "Trial interrupted. Click the blue center " +
        "point to restart this trial.";

    feedback.style.color = "#c0392b";

    // The interrupted trial is discarded and retried.
    state = "ready";
}

window.addEventListener("blur", interruptTrial);

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        interruptTrial();
    }
});

// Pause if the window becomes too narrow
window.addEventListener("resize", () => {
    if (experimentScreen.hidden) return;

    if (!targetsFit()) {
        state = "paused";
        targetCircle.style.display = "none";

        feedback.textContent =
            "Testing paused: maximize your browser window.";
    } else if (state === "paused") {
        prepareTrial();
    } else if (state === "active") {
        interruptTrial();
    }
});

// Verify collected results
function validateResults() {
    if (results.length !== TOTAL_TRIALS) {
        return false;
    }

    for (let block = 1; block <= TOTAL_BLOCKS; block++) {
        const blockRows = results.filter(
            row => row.block === block
        );

        const combinations = new Set(
            blockRows.map(row =>
                `${row.diameterPx}-${row.distancePx}-${row.direction}`
            )
        );

        if (
            blockRows.length !== TRIALS_PER_BLOCK ||
            combinations.size !== TRIALS_PER_BLOCK
        ) {
            return false;
        }
    }

    return results.every(row =>
        row.participantID === participantID &&
        row.consentGiven === true &&
        Number.isFinite(row.completionTimeMs) &&
        row.completionTimeMs > 0 &&
        Number.isFinite(row.actualDistancePx) &&
        row.actualDistancePx >= 0 &&
        Number.isInteger(row.errors) &&
        row.errors >= 0
    );
}

// Display completion screen
function finishExperiment() {
    state = "finished";
    runCompleted = validateResults();

    experimentScreen.hidden = true;
    completionScreen.hidden = false;

    if (!runCompleted) {
        $("resultsSummary").textContent =
            "Data validation failed. Do not use these results.";
        $("downloadButton").disabled = true;
        return;
    }

    const totalErrors = results.reduce(
        (sum, row) => sum + row.errors, 0
    );

    const meanTime = results.reduce(
        (sum, row) => sum + row.completionTimeMs, 0
    ) / results.length;

    $("resultsSummary").textContent =
        `All ${results.length} trials verified. ` +
        `Average time: ${meanTime.toFixed(2)} ms. ` +
        `Total missed clicks: ${totalErrors}. ` +
        `Click Download Results to save your data.`;

    $("downloadButton").disabled = false;
}

// Escape CSV values correctly
function csvValue(value) {
    const text = String(value ?? "");

    return '"' + text.replace(/"/g, '""') + '"';
}

// Export verified data
$("downloadButton").addEventListener("click", () => {
    if (!runCompleted || !validateResults()) {
        alert("Results are incomplete or invalid.");
        return;
    }

    const columns = Object.keys(results[0]);

    const csvLines = [
        columns.join(","),
        ...results.map(row =>
            columns.map(column =>
                csvValue(row[column])
            ).join(",")
        )
    ];

    const csv = csvLines.join("\r\n");

    const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `FittsLaw_${participantID}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
