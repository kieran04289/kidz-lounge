import { useEffect, useRef, useState } from 'react';
import { MUTED, TONES, buttonStyle } from './uiTokens';

// Dictation into a writing box (Kieran, Oct 2026: session notes, PedsDesk).
// Uses the browser's own speech-to-text (Web Speech API), so where the
// audio goes is the browser's choice: Safari sends it to Apple's speech
// service, Chrome / Edge to Google / Microsoft; Firefox has none, and the
// button doesn't show there. A web page can't switch on the device's
// keyboard dictation itself. vercel.json's Permissions-Policy allows the
// microphone for the app's own pages (it used to block it).
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

// `onText(words)`: each finished phrase, to add to the box.
export default function DictateButton({ onText, disabled }) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);
  // Leaving the page stops the microphone.
  useEffect(() => () => { recRef.current?.abort(); }, []);

  if (!Recognition) return null;

  const stop = () => { recRef.current?.stop(); };
  const start = () => {
    setError(null);
    const rec = new Recognition();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      // Finished phrases go out together: boxes that take their whole new
      // text would otherwise drop all but the last of two in one event.
      let interim = '';
      let done = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) done += ` ${r[0].transcript}`;
        else interim += r[0].transcript;
      }
      if (done.trim()) onTextRef.current(done.trim());
      setHeard(interim);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Allow the microphone for this site to dictate.');
      else if (e.error === 'no-speech') setError('Nothing heard. Tap Dictate and try again.');
      else if (e.error !== 'aborted') setError("Dictation stopped. Tap Dictate to try again.");
    };
    // Safari also ends by itself after a pause.
    rec.onend = () => { setListening(false); setHeard(''); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setError("Dictation couldn't start. Tap Dictate to try again."); }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
      <button type="button" onClick={listening ? stop : start} disabled={disabled} aria-pressed={listening}
        style={buttonStyle(listening ? 'primary' : 'secondary', { padding: '4px 10px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 6 })}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" />
        </svg>
        {listening ? 'Stop' : 'Dictate'}
      </button>
      {listening && <span style={{ fontSize: 12.5, color: MUTED }}>{heard || 'Listening...'}</span>}
      {error && !listening && <span style={{ fontSize: 12.5, color: TONES.danger.fg }}>{error}</span>}
    </div>
  );
}
