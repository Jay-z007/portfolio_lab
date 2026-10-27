
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const messagesBox = document.getElementById("chatMessages");
const statusText = document.getElementById("chatStatus");
const sendButton = document.getElementById("chatSend");

// Portfolio knowledge base

const portfolioPrompt = `
You are the personal portfolio assistant for JAYz.

Help visitors learn about JAYz's skills and projects.

SKILLS:
- Python
- UI/UX Design
- JavaScript
- HTML
- CSS

PROJECTS:

1. Fibonacci Series
Purpose: Generates the Fibonacci sequence starting from 0 and 1.
GitHub: https://github.com/Jay-z007/python_basics_25bcon0692_fibionacci

2. Factorial
Purpose: Calculates the factorial of a number.
GitHub: https://github.com/Jay-z007/python-basics-25bcon0692-factorial

3. Struct to Dict
Purpose: Converts a struct into a dictionary.
GitHub: https://github.com/Jay-z007/python_basics_25bcon0692_struct_to_dict

4. Reading List
Purpose: A list of books JAYz has read.
GitHub: https://github.com/Jay-z007/readinglist2

5. Quiz Game
Purpose: Tests the user's knowledge of a subject.
GitHub: https://github.com/Jay-z007/quiz

6. Messy
Purpose: A website that helps users calculate their marks.
GitHub: https://github.com/Jay-z007/messy

7. Bug Fixing
Purpose: A project focused on fixing bugs in code.
GitHub: https://github.com/Jay-z007/bug_fixing

RESPONSE FORMATTING RULES:
- Use plain text, not Markdown tables.
- Do not use Markdown table separators such as |---|---|.
- Avoid Markdown headings using # symbols.
- For project lists, use numbered lists with short descriptions.
- Put each GitHub URL on its own line.
- Answer in a natural, conversational tone.
- Keep answers concise and easy to read.
- Never invent project features or personal details.
- If information is missing, say it is not specified.
`;


// Keep the conversation in memory while this page is open.
const conversationHistory = [];

const MAX_HISTORY_MESSAGES = 20;
let isSending = false;


function showMessage(text, kind) {
    const p = document.createElement("p");
    p.className =
      kind === "user" ? "user-message" : "bot-message";
  
    if (kind === "user") {
      p.textContent = text;
    } else {
      // Render a small, safe subset of Markdown.
      // Only plain text and HTTP(S) links are allowed.
      const lines = text.split(/\n+/);
  
      function appendFormattedText(parent, content) {
        const pattern =
          /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
  
        let lastIndex = 0;
        let match;
  
        while ((match = pattern.exec(content)) !== null) {
          parent.appendChild(
            document.createTextNode(content.slice(lastIndex, match.index))
          );
  
          const isMarkdownLink = Boolean(match[1]);
          const url = isMarkdownLink ? match[2] : match[3];
          const label = isMarkdownLink ? match[1] : url;
  
          // Remove trailing punctuation from plain URLs.
          let cleanUrl = url;
          if (!isMarkdownLink) {
            const trailing = cleanUrl.match(/[.,!?;:]+$/);
            if (trailing) cleanUrl = cleanUrl.slice(0, -trailing[0].length);
          }
  
          if (cleanUrl) {
            const link = document.createElement("a");
            link.href = cleanUrl;
            link.textContent = isMarkdownLink ? label : cleanUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            parent.appendChild(link);
          }
  
          if (!isMarkdownLink && cleanUrl.length < url.length) {
            parent.appendChild(
              document.createTextNode(url.slice(cleanUrl.length))
            );
          }
  
          lastIndex = pattern.lastIndex;
        }
  
        parent.appendChild(
          document.createTextNode(content.slice(lastIndex))
        );
      }
  
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
  
        const lineElement = document.createElement("div");
        lineElement.className = "bot-line";
  
        // Support simple numbered and bulleted lists.
        const itemMatch = trimmed.match(
          /^(?:[-*]\s+|\d+[.)]\s+)/
        );
  
        let content = itemMatch
          ? trimmed.slice(itemMatch[0].length)
          : trimmed;
  
        // Support bold text using **text**.
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
  
        parts.forEach((part) => {
          const boldMatch = part.match(/^\*\*(.+)\*\*$/);
  
          if (boldMatch) {
            const strong = document.createElement("strong");
            appendFormattedText(strong, boldMatch[1]);
            lineElement.appendChild(strong);
          } else {
            appendFormattedText(lineElement, part);
          }
        });
  
        if (itemMatch) {
          lineElement.classList.add("bot-list-item");
          lineElement.style.marginLeft = "12px";
        }
  
        p.appendChild(lineElement);
      });
    }
  
    messagesBox.appendChild(p);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }
  

function setStatus(message) {
  statusText.textContent = message;
}

function getConfig() {
  // Supports window.CONFIG from config.js.
  if (!window.CONFIG) {
    throw new Error(
      "Configuration not found. Check config.js and script order."
    );
  }

  if (
    !window.CONFIG.apiKey ||
    !window.CONFIG.baseUrl ||
    !window.CONFIG.model
  ) {
    throw new Error(
      "Configuration is incomplete. Check config.js."
    );
  }

  if (
    window.CONFIG.apiKey === "YOUR_REAL_GROQ_API_KEY" ||
    window.CONFIG.apiKey === "PASTE_YOUR_GROQ_API_KEY_HERE"
  ) {
    throw new Error("Add your Groq API key in config.js.");
  }

  return window.CONFIG;
}

if (!form || !input || !messagesBox || !statusText || !sendButton) {
  console.error(
    "Chatbot initialization failed: one or more HTML elements are missing."
  );
} else {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSending) return;

    const question = input.value.trim();

    if (!question) {
      setStatus("Please type a question.");
      input.focus();
      return;
    }

    let config;

    try {
      config = getConfig();
    } catch (error) {
      setStatus(error.message);
      console.error("Chatbot configuration error:", error);
      return;
    }

    isSending = true;
    sendButton.disabled = true;
    input.disabled = true;

    showMessage(question, "user");
    input.value = "";
    setStatus("Thinking...");

    // Add the current question to a temporary request history.
    const pendingHistory = [
      ...conversationHistory,
      { role: "user", content: question }
    ];

    // Keep only the most recent messages.
    const recentHistory = pendingHistory.slice(
      -MAX_HISTORY_MESSAGES
    );

    try {
      const baseUrl = config.baseUrl.replace(/\/+$/, "");

      const response = await fetch(
        `${baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.5,
            messages: [
              {
                role: "system",
                content: portfolioPrompt
              },
              ...recentHistory
            ]
          })
        }
      );

      // Read the response body once.
      const data = await response.json();

      if (!response.ok) {
        const apiMessage =
          data?.error?.message ||
          `Request failed with HTTP ${response.status}.`;

        if (response.status === 401) {
          throw new Error(
            "Authentication failed. Check your Groq API key."
          );
        }

        if (response.status === 429) {
          throw new Error(
            "Rate limit or quota reached. Please wait and try again."
          );
        }

        if (response.status === 404) {
          throw new Error(
            "The requested model or endpoint was not found. Check config.js."
          );
        }

        throw new Error(apiMessage);
      }

      const answer =
        data?.choices?.[0]?.message?.content?.trim();

      if (!answer) {
        throw new Error("The AI returned an empty response.");
      }

      showMessage(answer, "bot");

      // Save both messages only after a successful response.
      conversationHistory.push(
        { role: "user", content: question },
        { role: "assistant", content: answer }
      );

      // Bound the saved history.
      if (
        conversationHistory.length > MAX_HISTORY_MESSAGES
      ) {
        conversationHistory.splice(
          0,
          conversationHistory.length - MAX_HISTORY_MESSAGES
        );
      }

      setStatus("");

    } catch (error) {
      console.error("Chatbot request error:", error);

      if (
        error instanceof TypeError &&
        /fetch/i.test(error.message)
      ) {
        setStatus(
          "Network request failed. Check your connection or browser Console."
        );
      } else {
        setStatus("Chat unavailable: " + error.message);
      }

    } finally {
      isSending = false;
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
}
