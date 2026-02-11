import React, { useEffect, useState } from "react";
import { Podcast } from "@/api/entities";

const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

// Module-level cache — survives unmounts, lives for the entire session.
// On first visit we fetch + build + preload; on repeat visits we reuse instantly.
let cachedRows = null;

export default function AnimatedBackground() {
  const [rows, setRows] = useState(cachedRows || []);

  useEffect(() => {
    // If we already built the grid this session, nothing to do.
    if (cachedRows) return;

    const setupGrid = async () => {
      let allPodcasts = await Podcast.list();
      allPodcasts = allPodcasts.results || [];

      if (allPodcasts.length === 0) return;

      const podcastItems = allPodcasts.map(p => ({
        id: p.id,
        cover_image: p.cover_image,
        title: p.title
      }));

      // Preload all unique cover images so they appear together, not one-by-one.
      const urls = [...new Set(podcastItems.map(p => p.cover_image).filter(Boolean))];
      await Promise.all(urls.map(src => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => {});
      }));

      const numRows = 7;
      let displayItems = [];
      while (displayItems.length < numRows * 12) {
        displayItems = [...displayItems, ...shuffleArray([...podcastItems])];
      }

      const preparedRows = Array.from({ length: numRows }, () => []);
      displayItems.forEach((item, index) => {
        preparedRows[index % numRows].push({
          ...item,
          uniqueId: `${item.id}-${Math.floor(index / podcastItems.length)}-${index % numRows}`
        });
      });

      const finalRows = preparedRows.map(row => [...row, ...row, ...row]);

      // Cache for the rest of the session
      cachedRows = finalRows;
      setRows(finalRows);
    };

    setupGrid();
  }, []);

  const animationDurations = [65, 80, 58, 85, 72, 68, 78];

  return (
    <div
      id="albumGrid"
      className="absolute top-[-20%] left-[-10%] w-[120%] h-[140%] transform -rotate-[15deg] opacity-20 z-0 overflow-hidden"
    >
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 mb-4"
          style={{
            animation: `float-row ${animationDurations[rowIndex % animationDurations.length]}s linear infinite`,
            animationDirection: rowIndex % 2 === 0 ? 'normal' : 'reverse',
            willChange: 'transform',
          }}
        >
          {row.map((podcast) => (
            <div
              key={podcast.uniqueId}
              className="w-44 h-44 rounded-xl bg-eeriecast-surface-light flex-shrink-0 overflow-hidden"
            >
              {podcast.cover_image ? (
                <img
                  src={podcast.cover_image}
                  alt={podcast.title}
                  className="w-full h-full object-cover rounded-xl filter grayscale brightness-[0.4] contrast-[1.1]"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-eeriecast-surface-light" />
              )}
            </div>
          ))}
        </div>
      ))}
      <style>{`
        @keyframes float-row {
          from { transform: translateX(0%); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
