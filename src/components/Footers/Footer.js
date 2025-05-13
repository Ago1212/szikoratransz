import React from "react";

export default function Footer() {
  return (
    <footer className="relative bg-blueGray-200 pt-8 pb-6">
      <div
        className="bottom-auto top-0 left-0 right-0 w-full absolute pointer-events-none overflow-hidden -mt-20 h-20"
        style={{ transform: "translateZ(0)" }}
      >
        <svg
          className="absolute bottom-0 overflow-hidden"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 2560 100"
          aria-hidden="true"
        >
          <polygon
            className="text-blueGray-200 fill-current"
            points="2560 0 2560 100 0 100"
          />
        </svg>
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-wrap text-center lg:text-left">
          {/* Bal oldali oszlop: Kapcsolat */}
          <div className="w-full lg:w-6/12 px-4">
            <h2 className="text-3xl font-semibold">
              Vedd fel velünk a kapcsolatot!
            </h2>
            <div className="mt-4">
              <p className="text-lg mb-2">
                <i className="fas fa-envelope mr-2"></i> szikoratransz@gmail.com
              </p>
              <p className="text-lg mb-2">
                <i className="fas fa-phone mr-2"></i> +36 30 811 5776 / +36 20
                243 3368
              </p>
              <p className="text-lg">
                <i className="fas fa-map-marker-alt mr-2"></i> 2518 Leányvár,
                Bécsi út 86
              </p>
            </div>
          </div>

          {/* Jobb oldali oszlop: Térkép és közösségi média */}
          <div className="w-full lg:w-6/12 px-4 mt-8 lg:mt-0 flex flex-col items-center lg:items-end gap-4">
            {/* Térkép */}
            <div className="w-full lg:w-96 h-64">
              <iframe
                title="Térkép"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2685.962275700994!2d18.770399076915425!3d47.6851525825491!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4c8579a71faf6655%3A0x4bc9fef3782d8c54!2sSzikora%20Transz%20Kft!5e0!3m2!1shu!2shu!4v1747153064329!5m2!1shu!2shu"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>

            {/* Közösségi média */}
            <div className="mt-4">
              <h3 className="text-xl font-semibold mb-2 text-center lg:text-right">
                Kövess minket!
              </h3>
              <div className="flex justify-center lg:justify-end space-x-4">
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
      </div>
    </footer>
  );
}
