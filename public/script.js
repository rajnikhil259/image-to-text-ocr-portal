 const imageInput = document.getElementById("imageInput");
    const imagePreview = document.getElementById("imagePreview");
    const outputText = document.getElementById("outputText");
    const statsDiv = document.getElementById("textStats");

    /* Feature 2: Image Preview */
    imageInput.addEventListener("change", () => {
      const file = imageInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        imagePreview.src = reader.result;
        imagePreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    });
     
    document.getElementById("convertBtn").addEventListener("click", async () => {
  const imageInput = document.getElementById("imageInput");
  if (!imageInput.files[0]) {
    alert("Please select an image");
    return;
  }

  const formData = new FormData();
  formData.append("image", imageInput.files[0]);

  try {
    const response = await fetch("/ocr", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    outputText.value = data.text;

    // 🔑 Update statistics after OCR
    updateStats();

  } catch (err) {
    console.error(err);
    alert("OCR failed. Try again.");
  }
});


    /* Font change */
    function changeFont() {
      outputText.style.fontFamily =
        document.getElementById("fontSelector").value;
    }

    /* Feature 3: Text Statistics */
    outputText.addEventListener("input", updateStats);

    function updateStats() {
      const text = outputText.value.trim();

      const characters = text.length;
      const words = text ? text.split(/\s+/).length : 0;
      const lines = text ? text.split(/\n+/).length : 0;
      const avgWordLength = words ? (characters / words).toFixed(2) : 0;

      statsDiv.innerHTML = `
        <b>Text Statistics:</b>
        <p>Words: ${words}</p>
        <p>Lines: ${lines}</p>
        <p>Characters: ${characters}</p>
        <p>Average Word Length: ${avgWordLength}</p>
      `;
    }

    /* DOCX Download Feature */
    function downloadDocx() {
      const text = outputText.value;
      if (!text) {
        alert("No text available to download.");
        return;
      }

      const blob = new Blob([text], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "ocr_output.docx";
      link.click();
    }

    // Spell checker dictionary
    let dictionary = [];
    let dictionaryLoaded = false;

    async function loadDictionary() {
      try {
        const res = await fetch("punjabi_vocabulary.txt");
        if (!res.ok) throw new Error("dictionary fetch failed");
        const text = await res.text();

        dictionary = text
          .split("\n")
          .map((w) => w.trim())
          .filter((w) => w.length > 0);

        console.log("Dictionary loaded:", dictionary.length);
        dictionaryLoaded = true;
      } catch (err) {
        console.warn("Could not load punjabi_vocabulary.txt, using empty dictionary", err);
        dictionary = [];
        dictionaryLoaded = true;
      }
    }

    loadDictionary();

    document.getElementById("spellCheckBtn").addEventListener("click", async () => {
      if (!dictionaryLoaded) {
        document.getElementById("spellCheckBtn").textContent = "Loading...";
        await loadDictionary();
        document.getElementById("spellCheckBtn").textContent = "Check Spelling";
      }
      checkSpelling();
    });

    function hamming(a, b) {
      if (a.length !== b.length) return "-";
      let d = 0;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) d++;
      }
      return d;
    }

    function lcs(a, b) {
      const m = a.length;
      const n = b.length;
      const dp = [];
      for (let i = 0; i <= m; i++) dp[i] = Array(n + 1).fill(0);
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
      return dp[m][n];
    }

    function levenshtein(a, b) {
      const m = a.length;
      const n = b.length;
      const dp = [];
      for (let i = 0; i <= m; i++) dp[i] = Array(n + 1).fill(0);
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
          else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
        }
      }
      return dp[m][n];
    }

    function jaro(s1, s2) {
      if (s1 === s2) return 1;
      const len1 = s1.length;
      const len2 = s2.length;
      const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1;
      const s1Matches = new Array(len1).fill(false);
      const s2Matches = new Array(len2).fill(false);
      let matches = 0;
      let transpositions = 0;
      for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchDist);
        const end = Math.min(i + matchDist + 1, len2);
        for (let j = start; j < end; j++) {
          if (s2Matches[j]) continue;
          if (s1[i] !== s2[j]) continue;
          s1Matches[i] = true;
          s2Matches[j] = true;
          matches++;
          break;
        }
      }
      if (matches === 0) return 0;
      let k = 0;
      for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
      }
      const score = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
      return score.toFixed(3);
    }

    function backoff(word) {
      for (let i = word.length - 1; i > 2; i--) {
        let prefix = word.substring(0, i);
        if (dictionary.includes(prefix)) {
          return { correct: prefix, wrong: word.substring(i), method: "prefix-split" };
        }
      }
      for (let i = 0; i < word.length; i++) {
        let candidate = word.slice(0, i) + word.slice(i + 1);
        if (dictionary.includes(candidate)) {
          return { correct: candidate, wrong: "(extra char removed)", method: "delete" };
        }
      }
      return null;
    }

    function checkSpelling() {
      const input = outputText.value;
      const words = input.match(/[\u0A00-\u0A7F]+/g) || [];
      const table = document.getElementById("resultTable");
      table.innerHTML = `
      <tr>
        <th>Word</th>
        <th>Hamming</th>
        <th>LCS</th>
        <th>Levenshtein</th>
        <th>Jaro</th>
        <th>Composite</th>
        <th>Benchmark</th>
      </tr>
      `;

      words.forEach((word) => {
        let bestWord = "";
        let bestComposite = -1;
        let bestLev = Infinity;
        const minLen = Math.max(1, word.length - 3);
        const maxLen = word.length + 3;

        dictionary.forEach((dict) => {
          if (dict.length < minLen || dict.length > maxLen) return;

          const lev = levenshtein(word, dict);
          const jaroScore = parseFloat(jaro(word, dict));
          const lcsScore = lcs(word, dict);

          const maxLenWord = Math.max(word.length, dict.length);
          const levNorm = 1 - lev / (maxLenWord || 1);
          const lcsNorm = lcsScore / (maxLenWord || 1);

          const composite = (jaroScore + levNorm + lcsNorm) / 3;

          if (composite > bestComposite || (composite === bestComposite && lev < bestLev)) {
            bestComposite = composite;
            bestWord = dict;
            bestLev = lev;
          }
        });

        const ham = hamming(word, bestWord);
        const lcsScoreFinal = lcs(word, bestWord);
        const levScore = levenshtein(word, bestWord);
        const jaroScoreFinal = jaro(word, bestWord);

        let status = "Wrong";
        let benchmark = "Low";

        if (dictionary.includes(word)) {
          status = "Correct";
          benchmark = "Exact";
        } else if (bestComposite >= 0.85) {
          status = "Maybe";
          benchmark = "High";
        } else if (bestComposite >= 0.65) {
          status = "Maybe";
          benchmark = "Medium";
        }

        const rowClass =
          status === "Correct"
            ? "correct"
            : benchmark === "High"
            ? "maybe"
            : benchmark === "Medium"
            ? "medium"
            : "wrong";

        let row = `
        <tr class="${rowClass}">
          <td>${word}</td>
          <td>${ham}</td>
          <td>${lcsScoreFinal}</td>
          <td>${levScore}</td>
          <td>${jaroScoreFinal}</td>
          <td>${bestComposite.toFixed(3)}</td>
          <td>${benchmark}</td>
        </tr>
        `;

        table.innerHTML += row;

        if (status !== "Correct") {
          const parts = backoff(word);
          if (parts) {
            let backRow = `
            <tr>
              <td colspan="7">
                Partial Correct: <b>${parts.correct}</b> <span style="color:red">${parts.wrong}</span> <i>[${parts.method}]</i>
              </td>
            </tr>
            `;
            table.innerHTML += backRow;
          } else if (bestWord) {
            let backRow = `
            <tr>
              <td colspan="7">
                Suggestion: <b>${bestWord}</b> (best candidate)
              </td>
            </tr>
            `;
            table.innerHTML += backRow;
          }
        }
      });
    }