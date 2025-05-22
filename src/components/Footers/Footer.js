import React from "react";

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white pt-12 pb-10 shadow-inner">
      <div className="container mx-auto px-6">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-10">
          {/* Kapcsolat */}
          <div className="lg:w-1/2 w-full">
            <h2 className="text-2xl font-bold mb-4">
              Vedd fel velünk a kapcsolatot!
            </h2>
            <ul className="space-y-2 text-base">
              <li>
                <i className="fas fa-envelope mr-2 text-blue-400"></i>
                szikoratransz@gmail.com
              </li>
              <li>
                <i className="fas fa-phone mr-2 text-blue-400"></i>
                +36 30 811 5776 / +36 20 243 3368
              </li>
              <li>
                <i className="fas fa-map-marker-alt mr-2 text-blue-400"></i>
                2518 Leányvár, Bécsi út 86
              </li>
            </ul>

            {/* Közösségi ikonok */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Kövess minket!</h3>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="text-blue-400 hover:text-white transition text-2xl"
                >
                  <i className="fab fa-facebook"></i>
                </a>
                <a
                  href="#"
                  className="text-pink-400 hover:text-white transition text-2xl"
                >
                  <i className="fab fa-instagram"></i>
                </a>
              </div>
            </div>
          </div>

          {/* Térkép */}
          <div className="lg:w-1/2 w-full">
            <div className="rounded-lg overflow-hidden shadow-lg border border-gray-700 h-64 w-full">
              <iframe
                title="Térkép"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2685.962275700994!2d18.770399076915425!3d47.6851525825491!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4c8579a71faf6655%3A0x4bc9fef3782d8c54!2sSzikora%20Transz%20Kft!5e0!3m2!1shu!2hu!4v1747153064329!5m2!1shu!2hu"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
