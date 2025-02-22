// text-counter.ts
export class WordsCounter {
    private chinese = 0;
    private words = 0;
    private numbers = 0;
    private pendingWord = false;
    private pendingNumber = false;
    private pendingBuffer = "";
  
    public addText(fragment: string): void {
      for (const char of fragment) {
        const code = char.charCodeAt(0);
  
        // 汉字检测（立即计数）
        if (code >= 0x4E00 && code <= 0x9FFF) {
          this.chinese++;
          this.commitPending();
          continue;
        }
  
        // 字母处理
        if (/[a-zA-Z]/.test(char)) {
          this.pendingBuffer += char;
          this.pendingWord = true;
          if (this.pendingNumber) {
            // 数字转单词时修正计数
            this.numbers--;
            this.pendingNumber = false;
          }
          continue;
        }
  
        // 数字处理
        if (/\d/.test(char)) {
          if (!this.pendingWord && !this.pendingNumber) {
            this.numbers++;
            this.pendingNumber = true;
          }
          this.pendingBuffer = "";
          continue;
        }
  
        // 分隔符处理
        this.commitPending();
      }
  
      // 处理片段末尾的未提交内容
      this.commitPending();
    }
  
    public getTotal(): number {
      return this.chinese + this.words + this.numbers;
    }
  
    public reset(): void {
      this.chinese = 0;
      this.words = 0;
      this.numbers = 0;
      this.pendingWord = false;
      this.pendingNumber = false;
      this.pendingBuffer = "";
    }
  
    private commitPending(): void {
      if (this.pendingBuffer.length > 0) {
        this.words++;
        this.pendingBuffer = "";
      }
      this.pendingWord = false;
      this.pendingNumber = false;
    }
  }
  