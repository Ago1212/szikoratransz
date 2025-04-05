import React from "react";

export default function Footer() {
  return (
    <footer className="relative bg-blueGray-200 pt-8 pb-6">
      {/* Decorative top wave */}
      <div
        className="bottom-auto top-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden -mt-20 h-20"
        style={{ transform: "translateZ(0)" }}
      >
        <svg
          className="absolute bottom-0 overflow-hidden"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          version="1.1"
          viewBox="0 0 2560 100"
          x="0"
          y="0"
          aria-hidden="true" // Hide from screen readers
        >
          <polygon
            className="text-blueGray-200 fill-current"
            points="2560 0 2560 100 0 100"
          />
        </svg>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-wrap text-center lg:text-left">
          <div className="w-full lg:w-6/12 px-4">
            <h2 className="text-3xl font-semibold">
              Vedd fel velünk a kapcsolatot!
            </h2>

            {/* Added contact information */}
            <div className="mt-4">
              <p className="text-lg mb-2">
                <i className="fas fa-envelope mr-2"></i> sziago12@gmail.com
              </p>
              <p className="text-lg mb-2">
                <i className="fas fa-phone mr-2"></i> +36 30 382 8537
              </p>
              <p className="text-lg">
                <i className="fas fa-map-marker-alt mr-2"></i> 2518
                Leányvár,Bécsi út 86
              </p>
            </div>
          </div>

          {/* Added social media links */}
          <div className="w-full lg:w-6/12 px-4 mt-8 lg:mt-0">
            <h3 className="text-xl font-semibold mb-4">Kövess minket!</h3>
            <div className="flex justify-center lg:justify-start space-x-4">
              <a
                href="#"
                className="text-blue-600 hover:text-blue-800 text-2xl"
              >
                <i className="fab fa-facebook"></i>
              </a>
              <a
                href="#"
                className="text-pink-600 hover:text-pink-800 text-2xl"
              >
                <i className="fab fa-instagram"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
