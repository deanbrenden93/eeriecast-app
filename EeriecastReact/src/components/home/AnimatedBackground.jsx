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

export default function AnimatedBackground() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const setupGrid = async () => {
      let allPodcasts = await Podcast.list();
      allPodcasts = allPodcasts.results || [];

      if (allPodcasts.length === 0) return;

      const podcastItems = allPodcasts.map(p => ({
        id: p.id,
        cover_image: p.cover_image,
        title: p.title
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
      
      setRows(preparedRows.map(row => [...row, ...row, ...row]));
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
                  loading="lazy"
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
