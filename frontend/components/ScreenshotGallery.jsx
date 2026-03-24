'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { getScreenshotImageUrl } from '../lib/api';

function buildSrc(fileId) {
  return getScreenshotImageUrl(fileId);
}

export default function ScreenshotGallery({ screenshots = [], loading = false }) {
  const [lightbox, setLightbox] = useState(null);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-video animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    );
  }

  if (!screenshots.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No screenshots for this period.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {screenshots.map((ss) => (
          <button
            key={ss._id}
            onClick={() => setLightbox(ss)}
            className="group relative aspect-video overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 transition hover:ring-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <img
              src={buildSrc(ss.fileId)}
              alt={format(new Date(ss.timestamp), 'PPp')}
              className="h-full w-full object-cover transition group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
              <p className="text-xs font-medium text-white">
                {format(new Date(ss.timestamp), 'HH:mm')}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">
                {format(new Date(lightbox.timestamp), 'PPpp')}
              </p>
              <button
                onClick={() => setLightbox(null)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <img
              src={buildSrc(lightbox.fileId)}
              alt="Screenshot"
              className="max-h-[80vh] w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
