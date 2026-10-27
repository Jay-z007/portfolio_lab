
const PORTFOLIO_PROMPT = `
You are the personal portfolio assistant for JAYz.

Help visitors learn about JAYz using only the information below.

ABOUT:
JAYz is a Computer Science and Engineering student at
JECRC University, interested in programming, web development,
and UI/UX design.

SKILLS:
- Python
- UI/UX Design
- JavaScript
- HTML
- CSS

PROJECTS:

1. Fibonacci Series
Generates the Fibonacci sequence starting from 0 and 1.
https://github.com/Jay-z007/python_basics_25bcon0692_fibionacci

2. Factorial
Calculates the factorial of a given number.
https://github.com/Jay-z007/python-basics-25bcon0692-factorial

3. Struct to Dict
Converts a struct into a dictionary.
https://github.com/Jay-z007/python_basics_25bcon0692_struct_to_dict

4. Reading List
A list of books JAYz has read.
https://github.com/Jay-z007/readinglist2

5. Quiz Game
A game that tests the user's knowledge of a subject.
https://github.com/Jay-z007/quiz

6. Messy
A website that helps users calculate their marks.
https://github.com/Jay-z007/messy

7. Bug Fixing
A project focused on fixing bugs in code.
https://github.com/Jay-z007/bug_fixing

RULES:
- Be friendly, professional, and concise.
- Answer portfolio questions using only the facts above.
- Never invent achievements, experience, or project features.
- If a personal detail is missing, say it is not specified.
- Use readable lists, not Markdown tables.
- Put each project on a separate line.
- Include the relevant GitHub link when asked about a project.
- Keep most responses under 120 words.
`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed. Use POST."
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error("GROQ_API_KEY is missing from the environment.");
    return res.status(500).json({
      error: "The chatbot is not configured on the server."
    });
  }

  try {
    const incomingMessages = req.body?.messages;

    if (
      !Array.isArray(incomingMessages) ||
      incomingMessages.length === 0
    ) {
      return res.status(400).json({
        error: "Please provide a conversation message."
      });
    }

    const history = incomingMessages
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].includes(message.role) &&
          typeof message.content === "string"
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 4000)
      }));

    if (
      history.length === 0 ||
      history[history.length - 1].role !== "user"
    ) {
      return res.status(400).json({
        error: "A user question is required."
      });
    }

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b",
          temperature: 0.5,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: PORTFOLIO_PROMPT
            },
            ...history
          ]
        })
      }
    );

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error(
        "Groq API error:",
        groqResponse.status,
        data?.error?.message || "Unknown error"
      );

      return res.status(502).json({
        error: "The AI service could not complete your request."
      });
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (typeof answer !== "string" || !answer.trim()) {
      return res.status(502).json({
        error: "The AI returned an empty response."
      });
    }

    return res.status(200).json({
      answer: answer.trim()
    });
  } catch (error) {
    console.error("Chat endpoint error:", error);

    return res.status(500).json({
      error: "Something went wrong. Please try again."
    });
  }
};
