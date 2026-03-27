import { useState, useRef, useCallback } from 'react';

export function useRTASR({ onResult }: { onResult: (text: string, isFinal: boolean) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      // 1. Fetch secure WS URL from our backend
      const tokenStr = localStorage.getItem('token');
      const res = await fetch('/api/voice/rtasr-url', {
        headers: tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {}
      });
      const { data } = await res.json();
      if (!data?.url) throw new Error('Failed to get ASR URL');

      const ws = new WebSocket(data.url);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsRecording(true);
        try {
          // 2. Start audio capture after WS connects
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaStreamRef.current = stream;

          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000 // Requests 16kHz if browser supports it
          });
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32Array to Int16Array (16-bit PCM)
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              ws.send(pcm16.buffer);
            }
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
        } catch (err: any) {
          setError(err.message || 'Microphone access denied');
          stopRecording();
        }
      };

      ws.onmessage = (e) => {
        try {
          const resp = JSON.parse(e.data);
          if (resp.action === 'started') {
            console.log('RTASR handshaked');
          } else if (resp.action === 'result') {
            const resultData = JSON.parse(resp.data);
            const cw = resultData.cn?.st?.rt?.[0]?.ws;
            let text = '';
            if (cw && Array.isArray(cw)) {
              cw.forEach((w: any) => {
                if (w.cw && w.cw[0]) text += w.cw[0].w;
              });
            }
            if (text) {
              const pgs = resultData.cn?.st?.pgs; // pgs: rpl -> replace, apd -> append
              const isFinal = resultData.cn?.st?.type === '0'; // 0: end of sentence, 1: intermediate
              onResult(text, isFinal);
            }
          } else if (resp.action === 'error') {
            setError(`ASR Error: ${resp.desc}`);
            stopRecording();
          }
        } catch (err) {
          console.error('Error parsing AS result', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket error occurred');
        stopRecording();
      };
      
      ws.onclose = () => {
        stopRecording();
      };

    } catch (err: any) {
      setError(err.message || 'Failed to start recording');
      setIsRecording(false);
    }
  }, [onResult]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Send end sign "{\"end\": true}"
        wsRef.current.send('{"end": true}');
        setTimeout(() => wsRef.current?.close(), 500);
      }
      wsRef.current = null;
    }
  }, []);

  return { isRecording, startRecording, stopRecording, error };
}
