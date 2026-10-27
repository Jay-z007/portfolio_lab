
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const messagesBox = document.getElementById("chatMessages");
const statusText = document.getElementById("chatStatus");
const sendButton = document.getElementById("chatSend");

const MAX_HISTORY_MESSAGES = 20;
const API_ENDPOINT = "/api/chat";

const conversationHistory = [];
let isSending = false;

// Display a message in the chat window.
function showMessage(text, kind) {
  const message = document.createElement("p");
  message.className =
    kind === "user" ? "user-message" : "bot-message";

  if (kind === "user") {
    message.textContent = text;
  } else {
    renderBotMessage(message, text);
  }

  messagesBox.appendChild(message);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// Safely render plain text, numbered lists, bold text,
// and clickable HTTP/HTTPS links without inserting HTML.
function renderBotMessage(container, text) {
  const lines = text.split(/\r?\n/);

  function appendFormattedText(parent, content) {
    const pattern =
      /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      parent.appendChild(
        document.createTextNode(
          content.slice(lastIndex, match.index)
        )
      );

      if (match[1]) {
        // Bold text: **example**
        const strong = document.createElement("strong");
        strong.textContent = match[1];
        parent.appendChild(strong);
      } else {
        const isMarkdownLink = Boolean(match[2]);
        let url = isMarkdownLink ? match[3] : match[4];
        const label = isMarkdownLink ? match[2] : url;

        // Remove trailing punctuation from ordinary URLs.
        if (!isMarkdownLink) {
          url = url.replace(/[.,!?;:]+$/, "");
        }

        try {
          const parsedUrl = new URL(url);

          if (
            parsedUrl.protocol === "https:" ||
            parsedUrl.protocol === "http:"
          ) {
            const link = document.createElement("a");
            link.href = parsedUrl.href;
            link.textContent = label;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            parent.appendChild(link);
          } else {
            parent.appendChild(document.createTextNode(label));
          }
        } catch {
          parent.appendChild(document.createTextNode(label));
        }

        if (!isMarkdownLink && url.length < match[4].length) {
          parent.appendChild(
            document.createTextNode(match[4].slice(url.length))
          );
        }
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

    // Support numbered lists and bullet points.
    const listMatch = trimmed.match(
      /^(?:[-*]\s+|\d+[.)]\s+)/
    );

    const content = listMatch
      ? trimmed.slice(listMatch[0].length)
      : trimmed;

    if (listMatch) {
      lineElement.classList.add("bot-list-item");
    }

    appendFormattedText(lineElement, content);
    container.appendChild(lineElement);
  });

  if (!container.childNodes.length) {
    container.textContent = text;
  }
}

function setStatus(message) {
  statusText.textContent = message;
}

function setSendingState(sending) {
  isSending = sending;
  sendButton.disabled = sending;
  input.disabled = sending;
}

function trimHistory() {
  if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    conversationHistory.splice(
      0,
      conversationHistory.length - MAX_HISTORY_MESSAGES
    );
  }

  // Ensure history starts with a user message.
  while (
    conversationHistory.length > 0 &&
    conversationHistory[0].role !== "user"
  ) {
    conversationHistory.shift();
  }
}

// Submit a question to the Vercel backend.
if (!form || !input || !messagesBox || !statusText || !sendButton) {
  console.error(
    "Chatbot initialization failed: check the HTML element IDs."
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

    showMessage(question, "user");
    input.value = "";

    setSendingState(true);
    setStatus("Thinking...");

    // Include previous successful messages and the new question.
    const requestHistory = [
      ...conversationHistory,
      { role: "user", content: question }
    ].slice(-MAX_HISTORY_MESSAGES);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: requestHistory
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "Chat endpoint not found. Check that api/chat.js is deployed."
          );
        }

        if (response.status === 429) {
          throw new Error(
            "Too many requests. Please wait and try again."
          );
        }

        throw new Error(
          data.error ||
          `Request failed with HTTP ${response.status}.`
        );
      }

      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("The server returned an empty response.");
      }

      const answer = data.answer.trim();

      showMessage(answer, "bot");

      // Save the conversation only after a successful response.
      conversationHistory.push(
        { role: "user", content: question },
        { role: "assistant", content: answer }
      );

      trimHistory();
      setStatus("");

    } catch (error) {
      console.error("Portfolio chatbot error:", error);

      if (error instanceof TypeError) {
        setStatus(
          "Unable to reach the chatbot server. Check your connection and deployment."
        );
      } else {
        setStatus("Chat unavailable: " + error.message);
      }
    } finally {
      setSendingState(false);
      input.focus();
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  });
}
