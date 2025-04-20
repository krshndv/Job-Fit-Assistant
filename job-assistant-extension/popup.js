import * as pdfjsLib from './lib/pdf.mjs';


pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.mjs');

document.getElementById("resumeInput").addEventListener("change", function () {
    const file = this.files[0];

    if (!file) {
        alert("No file selected.");
        return;
    }

    if (file.type !== "application/pdf") {
        alert("Only PDF resumes are supported right now.");
        return;
    }

    const reader = new FileReader();

    reader.onload = async function () {
        const typedArray = new Uint8Array(reader.result);

        try {
            const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items.map(item => item.str);
                fullText += strings.join(' ') + '\n';
            }

            chrome.storage.local.set({ resume: fullText }, () => {
                document.getElementById("resumeStatus").textContent = "PDF resume uploaded and parsed.";
                console.log(" Resume parsed and saved to storage.");
            });

        } catch (error) {
            alert("Error reading PDF: " + error.message);
            console.error("PDF parsing error:", error);
        }
    };

    reader.readAsArrayBuffer(file);
});


document.getElementById("clearResume").addEventListener("click", () => {
    chrome.storage.local.remove("resume", () => {
        // Reset file input field
        const input = document.getElementById("resumeInput");
        input.value = "";

        // Update UI
        document.getElementById("resumeStatus").textContent = "Resume cleared.";
    });
});

// Helper to safely get resume from Chrome storage
function getResumeFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get("resume", (result) => {
            resolve(result.resume);
        });
    });
}

document.getElementById("evaluateBtn").addEventListener("click", async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                function: () => {
                    // This runs in the context of the active page
                    return document.body.innerText.slice(0, 4000); // Naive JD extraction
                }
            },
            async (results) => {
                const jd = results?.[0]?.result;

                if (!jd || jd.trim() === "") {
                    alert("Could not extract job description from the current page.");
                    return;
                }

                const resume = await getResumeFromStorage();

                if (!resume) {
                    alert("Please upload your resume first.");
                    return;
                }

                document.getElementById("resultBox").innerText = "Analyzing fit... please wait...";

                chrome.runtime.sendMessage(
                    {
                        type: "sendToGPT",
                        resume: resume,
                        jd: jd
                    },
                    (response) => {
                        if (response.success) {
                            document.getElementById("resultBox").innerText = response.reply;
                        } else {
                            document.getElementById("resultBox").innerText = "Error: " + response.error;
                        }
                    }
                );
            }
        );
    } catch (error) {
        console.error("Error during evaluation:", error);
        alert("Something went wrong. Check the console for details.");
    }
});

const resumeInput   = document.getElementById('resumeInput');
const resumeStatus  = document.getElementById('resumeStatus');
const clearBtn      = document.getElementById('clearResume');

resumeInput.addEventListener('change', () => {
  if (resumeInput.files.length > 0) {
    resumeStatus.textContent = resumeInput.files[0].name;
  } else {
    resumeStatus.textContent = 'No resume uploaded.';
  }
});

clearBtn.addEventListener('click', () => {
  resumeInput.value = '';
  resumeStatus.textContent = 'No resume uploaded.';
});


function extractJobDescription() {
    return document.body.innerText.slice(0, 4000); // Naive JD extraction
}

async function sendToGPT(resume, jd) {
    const payload = {
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "system",
                content:
                    "You are a helpful career advisor. Given a resume and job description, evaluate the match and give constructive advice.",
            },
            {
                role: "user",
                content: `Resume:\n${resume}\n\nJob Description:\n${jd}\n\nPlease assess if the candidate is a good fit, and if not, suggest improvements.`,
            },
        ],
        temperature: 0.7,
        max_tokens: 800,
    };

    // 1) call the API, with the Bearer prefix
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // *** you must include "Bearer " in front of your key ***
            Authorization:
                "Bearer keep_your_api_key_here or use a .env file",
        },
        body: JSON.stringify(payload),
    });

    // 2) handle HTTP errors first
    if (!res.ok) {
        const errText = await res.text();
        console.error("OpenAI API HTTP Error:", res.status, errText);
        throw new Error(`OpenAI API returned ${res.status}`);
    }

    // 3) parse JSON
    const data = await res.json();

    // 4) make sure we actually got choices back
    if (!Array.isArray(data.choices) || data.choices.length === 0) {
        console.error("OpenAI API malformed response:", data);
        throw new Error("No choices returned from OpenAI");
    }

    // 5) return the assistant’s content
    return data.choices[0].message.content;
}
