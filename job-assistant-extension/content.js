function extractJobDescription() {
    // This grabs the visible text of the page
    const bodyText = document.body.innerText;

    // You can make this smarter later with filters for "Job Description" section
    return bodyText.slice(0, 4000); // Limit to first 4000 characters
}

// Make this function available for popup to call
extractJobDescription();
