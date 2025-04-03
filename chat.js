let keystrokes = [], clicks = [], drags = [], copies = [], pastes = [];
let allLogs = [];
let currentUserId = "", Purpose = "", API_KEY = '';
let lastSendTime = Date.now();
let pendingUserMessage = null;
let messageHistory = [];


let pendingLogEntry = null;
let selectedExpertise = null;

const textarea = document.getElementById("input");

function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

textarea.addEventListener("input", () => {
    textarea.style.height = "auto"; // 초기화
    const newHeight = Math.min(textarea.scrollHeight, 100); // 최대 100px
    textarea.style.height = `${newHeight}px`;
});

function selectExpertise(el, level) {
  // 기존 선택 제거
  document.querySelectorAll('.tag').forEach(tag => tag.classList.remove('selected'));
  
  // 새 선택 적용
  el.classList.add('selected');
  selectedExpertise = level;
}

async function startTask() {
    currentUserId = document.getElementById("user-id").value;
    Purpose = document.getElementById("purpose").value;
    API_KEY = document.getElementById("api-key").value;

    keystrokes = [];
    clicks = [];
    drags = [];
    copies = [];
    pastes = [];
    input.value = '';
    lastSendTime = Date.now();

    if (!currentUserId || !Purpose || !API_KEY) {
        alert("모든 항목을 입력해주세요.");
        return;
    }

    const isValidKey = await validateAPIKey(API_KEY);
    if (!isValidKey) {
        alert("API Key가 유효하지 않거나 권한이 없습니다. 다시 확인해주세요.");
        return;
    }

    messageHistory = [
        {
            role: "system",
            content: "당신은 사용자의 질문에 응답하는 AI Chatbot 입니다."
        }
    ];

    document.getElementById("start-form").classList.add("hidden");
    document.getElementById("chat-section").classList.remove("hidden");
    document.getElementById("exit").classList.remove("hidden"); 
}

// Key
document.addEventListener("keydown", e => keystrokes.push({ key: e.key, action: "down", time: Date.now() }));
document.addEventListener("keyup", e => keystrokes.push({ key: e.key, action: "up", time: Date.now() }));

// Mouse
document.addEventListener("mousedown", e => {
    clicks.push({
        action: "down",
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
        textContent: e.target.innerText || e.target.value || "",
        tag: e.target.tagName,
        classList: [...e.target.classList],
        id: e.target.id || null,
        type: e.target.type || null
        });
    });
  
  document.addEventListener("mouseup", e => {
    clicks.push({
        action: "up",
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
        textContent: e.target.innerText || e.target.value || "",
        tag: e.target.tagName,
        classList: [...e.target.classList],
        id: e.target.id || null,
        type: e.target.type || null
    });
    const selectedText = window.getSelection().toString().trim();
    // console.log(selectedText)
    if (selectedText) {
        drags.push({
        time: Date.now(),
        content: selectedText,
        x: e.clientX,
        y: e.clientY,
        targetText: e.target.innerText || e.target.value || ""
        });
    }
});

// Copy/Paste
document.addEventListener("copy", e => {
    copies.push({ contents: document.getSelection().toString(), time: Date.now() });
});
document.addEventListener("paste", e => {
    pastes.push({ contents: (e.clipboardData || window.clipboardData).getData('text'), time: Date.now() });
});

// console.log(clicks, drags, copies, pastes);

async function sendMessage() {
    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const userMessage = input.value;
    const now = Date.now();
    if (!userMessage){
        alert('질문을 작성해 주세요!')
        return;
    } 
    selectedExpertise = document.querySelector('.tag.selected');
    if (!selectedExpertise) {
        alert('전문도를 선택해주세요!');
        return;
    }
    const lastLog = allLogs[allLogs.length - 1];
    if (lastLog && lastLog.rating == null && lastLog.query !== "End") {
        alert("이전 응답에 대한 만족도를 평가해주세요!");
        return;
    }
    document.querySelectorAll('.satisfaction-rating').forEach(el => el.remove());

    // const expertiseLevel = selectedExpertise.innerText;

    // messageHistory.push({ role: "user", content: userMessage });
    // pendingUserMessage = userMessage;
    // const escapedUserMessage = escapeHTML(pendingUserMessage)?.replace(/\n/g, "<br>");
    // chat.innerHTML += `<div class="message user-message"><div class="bubble user-bubble">${escapedUserMessage}</div></div>`;
    // input.value = '';
    // chat.innerHTML += `<div class="message typing" id="typing-indicator"><em>답변을 작성 중입니다...</em></div>`;
    // chat.scrollTop = chat.scrollHeight;

    // //GPT API Call
    // const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //     method: 'POST',
    //     headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': API_KEY
    //     },
    //     body: JSON.stringify({
    //     model: "gpt-4o",
    //     messages: [{ role: "user", content: userMessage }]
    //     })
    // });

    // const data = await response.json();
    // const gptMessage = data.choices[0].message.content;
    // const htmlContent = marked.parse(gptMessage);;

    // document.getElementById('typing-indicator')?.remove();
    // chat.innerHTML += `<div class="message"><div>${htmlContent}</div></div>`;
    // // chat.scrollTop = chat.scrollHeight;

    // 👀 기억 5 turn
    const expertiseLevel = selectedExpertise.innerText;
    pendingUserMessage = userMessage;
    const escapedUserMessage = escapeHTML(pendingUserMessage)?.replace(/\n/g, "<br>");
    chat.innerHTML += `<div class="message user-message"><div class="bubble user-bubble">${escapedUserMessage}</div></div>`;
    input.value = '';
    chat.innerHTML += `<div class="message typing" id="typing-indicator"><em>답변을 작성 중입니다...</em></div>`;
    chat.scrollTop = chat.scrollHeight;

    messageHistory.push({ role: "user", content: userMessage });
    const baseSystemMsg = messageHistory[0]; // system 메시지 유지
    const nonSystemMessages = messageHistory.slice(1);
    const recentTurns = nonSystemMessages.slice(-10);
    const messagesToSend = [baseSystemMsg, ...recentTurns];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': API_KEY
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: messagesToSend
        })
    });

    console.log(messagesToSend)

    const data = await response.json();
    const gptMessage = data.choices[0].message.content;


    messageHistory.push({ role: "assistant", content: gptMessage });
    const htmlContent = marked.parse(gptMessage);
    // document.getElementById('typing-indicator')?.remove();
    // chat.innerHTML += `<div class="message"><div>${htmlContent}</div></div>`;
    document.getElementById('typing-indicator')?.remove();
    chat.innerHTML += `
    <div class="message">
        <div>${htmlContent}</div>
    </div>
    <div class="satisfaction-rating">
        <div class="rating-label">이 응답에 얼마나 만족했나요?</div>
        <div class="stars">
            <span onclick="submitRating(1)">★</span>
            <span onclick="submitRating(2)">★</span>
            <span onclick="submitRating(3)">★</span>
            <span onclick="submitRating(4)">★</span>
            <span onclick="submitRating(5)">★</span>
        </div>
    </div>
    `;
    // chat.scrollTop = chat.scrollHeight;
    chat.scrollTop += 320;

    // highlight code
    document.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));

    // log 저장
    allLogs.push({
        userId: currentUserId,
        purpose: Purpose,
        query: userMessage,
        expertise: expertiseLevel,
        agent_response: gptMessage,
        rating: null,
        querySendTime: now,
        keystroke: [...keystrokes],
        click: [...clicks],
        drag: [...drags],
        copy: [...copies],
        paste: [...pastes]
    });

    // lastQuery = userMessage;

    // 기록 초기화
    keystrokes = [];
    clicks = [];
    drags = [];
    copies = [];
    pastes = [];
    lastSendTime = now;

    document.querySelectorAll('.tag.selected').forEach(tag => tag.classList.remove('selected'));
    selectedExpertise = null;
    // updateSendButtonState();
}

textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); // 기본 줄바꿈 막기
        sendMessage();
    }
});

function submitExpertise(level) {
    document.getElementById('expertise-popup').classList.add('hidden');
    const lastLog = allLogs.findLast(log => log.query === lastQuery);
    if (lastLog) {
        lastLog.expertise = level;
    }
}


function endTask() {
    allLogs.push({
        userId: currentUserId,
        purpose: Purpose,
        query: "End",
        querySendTime: Date.now(),
        keystroke: [...keystrokes],
        click: [...clicks],
        drag: [...drags],
        copy: [...copies],
        paste: [...pastes]
    });

    const filename = `log_${currentUserId}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(allLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    alert("모든 로그가 저장되었습니다!");
    setTimeout(() => {
        location.reload();
    }, 1000);
}

async function validateAPIKey(key) {
    try {
        const res = await fetch("https://api.openai.com/v1/models", {
            headers: {
                "Authorization": key,
                "Content-Type": "application/json"
            }
        });
        return res.ok; // 200~299면 true, 아니면 false
    } catch (e) {
        return false;
    }
}

function submitRating(score) {
    const stars = document.querySelectorAll('.stars span');
    stars.forEach((star, idx) => {
        star.style.color = idx < score ? '#ffd700' : '#ccc';
    });

    const lastLog = allLogs[allLogs.length - 1];
    if (!lastLog) return;

    lastLog.rating = score;
    // lastLog.response_rate = score;

    const ratingUI = document.querySelector('.satisfaction-rating');
    if (ratingUI) {
        // 이미 메시지가 있으면 제거 후 다시 추가 (중복 방지)
        const prevMsg = ratingUI.querySelector('.saved-msg');
        if (prevMsg) prevMsg.remove();

        ratingUI.innerHTML += `<div class="saved-msg" style="margin-top: 8px; color: #00a873; font-weight: bold;">만족도 ${score}/5점으로 저장되었습니다.</div>`;
    }
}
