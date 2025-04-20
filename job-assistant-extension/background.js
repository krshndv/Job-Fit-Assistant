chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "sendToGPT") {
        const payload = {
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a supportive and honest career advisor. Your job is to analyze a user's resume against a job description and determine if they are a strong match. Always aim to be encouraging, even when the fit isn’t perfect. Your tone should be optimistic, helpful, and focused on growth. Your response should include: 1. A clear but gently worded fit assessment. 2. Specific reasons for the assessment (aligned or missing qualifications). 3. Actionable suggestions to help the user improve (technologies to learn, experience to gain, certifications to consider). 4. A motivational closing remark to inspire progress. Avoid harsh language. Always assume the user is eager to grow and improve.",
                },
                {
                    role: "user",
                    content: `The response from should be in only paragraph only. Resume:\n${message.resume}\n\nJob Description:\n${message.jd}\n\nCan you tell me if I'm a good fit for this job? If not, please explain why in a positive and encouraging way, and tell me how I can improve to be a better match in the future. The response must be under 20 words if the answer is yes. The word limit is 60 words if the answer is no. make you include the job title and company in your response`,
                },
            ],
            temperature: 0,
            max_tokens: 4000,
        };

        fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization:
                    "Bearer keep_your_api_key_here or use a .env file",
            },
            body: JSON.stringify(payload),
        })
            .then((res) => res.json())
            .then((data) => {
                const reply = data.choices?.[0]?.message?.content || "No valid response.";
                sendResponse({ success: true, reply });
            })
            .catch((err) => {
                console.error("Error in GPT call:", err);
                sendResponse({ success: false, error: err.message });
            });

        return true; //Important! Keeps sendResponse alive
    }
});


