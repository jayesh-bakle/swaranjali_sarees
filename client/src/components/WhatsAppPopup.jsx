import { useState, useEffect } from 'react';

const WHATSAPP_NUMBER = '918087194514'; // +91 8087194514

export default function WhatsAppPopup() {
  const [show, setShow] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Show popup after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  const chatUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello! I have a query about your sarees.')}`;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Chat Window */}
      {!minimized && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              S
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Swaranjali Sarees</p>
              <p className="text-xs text-green-200">Usually replies instantly</p>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="text-white/80 hover:text-white text-xl leading-none"
              aria-label="Minimize"
            >
              ✕
            </button>
          </div>

          {/* Chat Body */}
          <div className="bg-[#ece5dd] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHBhdGggZmlsbD0icmdiYSgwLDAsMCwwLjAzKSIgZD0iTTAgMGg2MHY2MEgweiIvPjwvc3ZnPg==')] px-4 py-5">
            <div className="bg-white rounded-lg px-3 py-2 shadow-sm max-w-[85%]">
              <p className="text-sm text-gray-800 leading-relaxed">
                Namaste! 🙏 Welcome to Swaranjali Sarees.
                <br /><br />
                How can we help you today? Feel free to ask about our collection, orders, or any queries!
              </p>
              <p className="text-[10px] text-gray-400 text-right mt-1">just now</p>
            </div>
          </div>

          {/* Action Button */}
          <div className="bg-white px-4 py-3 border-t border-gray-100">
            <a
              href={chatUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1da851] text-white font-semibold py-2.5 rounded-full transition-colors text-sm"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat on WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => {
          if (minimized) {
            setMinimized(false);
          } else {
            setShow(false);
            setTimeout(() => setShow(true), 300);
          }
        }}
        className="w-16 h-16 bg-[#25D366] hover:bg-[#1da851] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-9 h-9 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </button>
    </div>
  );
}