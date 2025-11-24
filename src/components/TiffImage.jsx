import React, { useEffect, useRef, useState } from 'react';
import Tiff from 'tiff.js';

const TiffImage = ({ src, alt, className, onError }) => {
  const containerRef = useRef(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAndDecode = async () => {
      if (!src) return;
      if (isMounted) {
          setLoading(true);
          setError(false);
      }
      
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const buffer = await response.arrayBuffer();
        
        if (!isMounted) return;

        // Initialize Tiff with the buffer
        // Handle potential ESM/CommonJS interop issues
        let TiffConstructor = Tiff;
        
        // Debug logging to understand what we got
        console.log('Tiff imported:', Tiff);
        
        if (typeof Tiff !== 'function') {
            if (Tiff && typeof Tiff.default === 'function') {
                TiffConstructor = Tiff.default;
            } else if (window.Tiff && typeof window.Tiff === 'function') {
                TiffConstructor = window.Tiff;
            }
        }

        if (typeof TiffConstructor !== 'function') {
             console.error('Tiff is not a constructor:', TiffConstructor);
             throw new Error('Tiff library not loaded correctly');
        }
        
        // Initialize the library if needed
        if (typeof TiffConstructor.initialize === 'function') {
            try {
                // Increase memory limit for large TIFF files
                // 16777216 * 10 is ~160MB. Increasing to ~512MB to handle multiple large files.
                TiffConstructor.initialize({ TOTAL_MEMORY: 536870912 }); 
            } catch {
                // Ignore if already initialized
            }
        }
        
        const tiff = new TiffConstructor({ buffer });
        let canvas;
        try {
            canvas = tiff.toCanvas();
        } catch (e) {
            throw e;
        } finally {
             // Important: Close the TIFF instance to free memory in the Emscripten heap
             // Failure to do this will cause "TIFFOpen returns NULL" after multiple loads
             tiff.close();
        }
        
        if (canvas) {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
                // Apply classes to the generated canvas
                canvas.className = 'w-full h-full';
                // Append the new canvas
                containerRef.current.appendChild(canvas);
            }
        } else {
            throw new Error('Failed to create canvas from TIFF');
        }
      } catch (error) {
        console.error("Error decoding TIFF:", error);
        if (isMounted) {
            setError(true);
            if (onError) onError(error);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAndDecode();

    return () => {
        isMounted = false;
    };
  }, [src]);

  if (error) {
      return (
        <div className={`${className} flex items-center justify-center bg-red-900/20 border border-red-500/50 text-red-400`}>
            <span className="text-xs text-center px-2">!</span>
        </div>
      );
  }

  return (
    <div className={`${className} relative overflow-hidden`}>
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
        )}
        <div 
            ref={containerRef} 
            className="w-full h-full"
            aria-label={alt}
            role="img"
        />
    </div>
  );
};

export default TiffImage;
