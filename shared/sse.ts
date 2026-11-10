export type SseMessage = {
    event: string;
    data: string;
};

export function createSseParser(
    onMessage: (message: SseMessage) => void,
) {
    const decoder = new TextDecoder('utf-8', {
        fatal: true,//decoder保留跨数据块的中文字符字节，避免乱码
    });

    let line = '';
    let dataLines : string[] = [];
    let event = 'message';
    let skipLF = false;
    let closed = false;
    let frameSize = 0;
    
    function consumeLine() {
      const current = line;
      line = '';
      
      //空行表示当前消息结束
      if (current.length === 0) {
        if (dataLines.length > 0) {
          onMessage({
            event:event || 'message',
            data: dataLines.join('\n'),
          });
        }
        dataLines = [];
        event = 'message';
        frameSize = 0;
        return;
      }
      
      if (current.startsWith(':')) {
        return;
      } 

      const colon = current.indexOf(':');

      const field = colon === -1
        ? current
        : current.slice(0, colon);

      let value = colon === -1
        ? ''
        : current.slice(colon + 1);  

      //只移除冒号后面的一个空格
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
      
      if(field === 'data'){
        dataLines.push(value);
      }

      if(field === 'event'){
        event = value;
      }

    }

    function consumeText(text: string){
        for(const char of text) {
            if(skipLF) {
                skipLF = false;

                if(char === '\n') continue;

            }
            frameSize += char.length;

            if(frameSize > 128*1024){
                throw new Error('单条SSE消息超过长度限制');
            }

            if(char === '\r' || char === '\n'){
                consumeLine();
                skipLF = char === '\r';

            }else{
                line += char;

            }
        }
    }
    return {
        push(chunk: Uint8Array){
            if(closed){
                throw new Error('SSE解析器已经结束')
            }

            const text = decoder.decode(chunk, {
                stream: true
            });

            consumeText(text);
        },

        finish(){
            if(closed){
                return;
            } 

            closed = true;

            consumeText(decoder.decode());

            //没有通过空行结束的消息不交付给业务代码
            line = '';
            dataLines = [];
        },
    };
}