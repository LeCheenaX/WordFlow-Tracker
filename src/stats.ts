export function wordsCounter() {
  let inWord = false;
  return function (input: string): number { 
      //console.log("string:", input) //debug
      let count = 0;
      for (const char of input) {
          const isWordChar = /^[\w'-]$/.test(char);
          const isCJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(char);
          if (isWordChar) {
              if (!inWord) {
                  count++;
                  inWord = true;
              }
          } else if (isCJK) {
              count++;
              inWord = false;
          } else {
              if (inWord) {
                  inWord = false;
              }
          }
      }
      return count;
  };
}
