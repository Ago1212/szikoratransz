import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";
import {
  FaUser,
  FaTruck,
  FaExclamationCircle,
  FaCalendarAlt,
  FaFileUpload,
  FaSignOutAlt,
  FaEdit,
  FaSave,
  FaTimes,
  FaSearch,
  FaFilter,
  FaPlus,
  FaImage,
  FaFilePdf,
  FaCar,
  FaIdCard,
  FaEnvelope,
  FaPhone,
  FaHome,
  FaBirthdayCake,
  FaCalendar,
  FaKey,
  FaTrash,
  FaTrailer,
  FaChevronUp,
  FaChevronDown,
} from "react-icons/fa";

export default function UserDashboard() {
  const history = useHistory();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState({});
  const [trucks, setTrucks] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [porkocsi, setPorkocsi] = useState([]);
  const [selectedPorkocsi, setSelectedPorkocsi] = useState(null);
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [reportType, setReportType] = useState("all");
  const [newReport, setNewReport] = useState({
    title: "",
    description: "",
    priority: "medium",
    attachments: [],
  });
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });
  const [activeFilters, setActiveFilters] = useState(0);
  const [truckScrollIndex, setTruckScrollIndex] = useState(0);
  const [trailerScrollIndex, setTrailerScrollIndex] = useState(0);

  // Felhasználói adatok betöltése
  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem("user"));
    if (!userData) {
      history.push("/login");
      return;
    }
    setUser(userData);
    setUserData(userData);
    loadKamionData();
    loadPotkocsiData();
  }, [history]);

  useEffect(() => {
    if (selectedPorkocsi) {
      setSelectedTruck(null);
      loadTruckReports(selectedPorkocsi.id);
    }
  }, [selectedPorkocsi]);
  // Felhasználó adatainak betöltése
  const loadKamionData = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getKamionok", {
        id: userData.id,
      });

      if (result?.success) {
        setTrucks(result.kamionok || []);
        if (result.kamionok && result.kamionok.length > 0) {
          setSelectedTruck(result.kamionok[0]);
        }
        setReports(result.reports || []);
        filterReports(result.reports || []);
      }
    } catch (error) {
      console.error("Hiba az adatok betöltésekor:", error);
    }
  };
  // Felhasználó adatainak betöltése
  const loadPotkocsiData = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem("user"));
      const result = await fetchAction("getPotkocsik", {
        id: userData.id,
      });

      if (result?.success) {
        setPorkocsi(result.potkocsik || []);
        setReports(result.reports || []);
        filterReports(result.reports || []);
      }
    } catch (error) {
      console.error("Hiba az adatok betöltésekor:", error);
    }
  };

  // Bejelentések betöltése kiválasztott kamionhoz
  useEffect(() => {
    if (selectedTruck) {
      setSelectedPorkocsi(null);
      loadTruckReports(selectedTruck.id);
    }
  }, [selectedTruck]);

  const loadTruckReports = async (selectedId) => {
    try {
      const result = await fetchAction("getTruckReports", {
        truckId: selectedId,
        type: selectedTruck ? "kamion" : "potkocsi",
        userId: user?.id,
      });

      if (result?.success) {
        setReports(result.reports || []);
        filterReports(result.reports || []);
      }
    } catch (error) {
      console.error("Hiba a bejelentések betöltésekor:", error);
    }
  };

  // Szűrés alkalmazása
  const filterReports = (reportsToFilter) => {
    let filtered = [...reportsToFilter];
    let filterCount = 0;

    // Saját/egyéb bejelentések szűrése
    if (reportType === "own") {
      filtered = filtered.filter((report) => report.userId === user?.id);
      filterCount++;
    } else if (reportType === "others") {
      filtered = filtered.filter((report) => report.userId !== user?.id);
      filterCount++;
    }

    // Dátum intervallum szűrés
    if (dateRange.start) {
      filtered = filtered.filter((report) => report.date >= dateRange.start);
      filterCount++;
    }
    if (dateRange.end) {
      filtered = filtered.filter((report) => report.date <= dateRange.end);
      filterCount++;
    }

    // Keresés szűrése
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (report) =>
          report.title?.toLowerCase().includes(term) ||
          report.description?.toLowerCase().includes(term) ||
          report.userName?.toLowerCase().includes(term),
      );
      filterCount++;
    }

    setFilteredReports(filtered);
    setActiveFilters(filterCount);
  };

  // Szűrők változásakor
  useEffect(() => {
    filterReports(reports);
  }, [searchTerm, dateRange, reportType, reports, user]);

  // Felhasználói adatok mentése
  const handleSaveUserData = async () => {
    setIsSaving(true);
    try {
      const result = await fetchAction("saveUserData", {
        id: userData.id,
        ...userData,
      });

      if (result?.success) {
        sessionStorage.setItem("user", JSON.stringify(result.user));
        setUser(result.user);
        alert("Adatok sikeresen mentve!");
        setIsEditing(false);
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Fájl feltöltés kezelése
  const handleFileUpload = async (files) => {
    setUploadingFiles(true);
    const uploadedFiles = [];

    for (let file of files) {
      const reader = new FileReader();

      await new Promise((resolve) => {
        reader.onloadend = async () => {
          const base64String = reader.result.split(",")[1];

          try {
            const result = await fetchAction("uploadFile", {
              fileName: file.name,
              fileSize: file.size,
              fileData: base64String,
              userId: user?.id,
              truckId: selectedTruck?.id,
            });

            if (result?.success) {
              uploadedFiles.push({
                id: result.fileId,
                name: file.name,
                path: result.filePath,
                type: file.type,
                size: file.size,
              });
            }
          } catch (error) {
            console.error("Fájl feltöltési hiba:", error);
            alert(`Hiba a(z) ${file.name} fájl feltöltésekor`);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    setUploadingFiles(false);
    return uploadedFiles;
  };

  // Új bejelentés elküldése
  const handleSubmitReport = async () => {
    if (!newReport.title.trim() || !newReport.description.trim()) {
      alert("Kérjük töltse ki a cím és leírás mezőket!");
      return;
    }

    if (!selectedTruck) {
      alert("Nincs kiválasztva kamion!");
      return;
    }

    try {
      const reportData = {
        ...newReport,
        userId: user.id,
        userName: user.name,
        truckId: selectedTruck.id,
        truckName: selectedTruck.rendszam,
        date: new Date().toISOString().split("T")[0],
        time: new Date().toLocaleTimeString("hu-HU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const result = await fetchAction("newBejelentes", reportData);

      if (result?.success) {
        alert("Bejelentés sikeresen elküldve!");
        setShowNewReportModal(false);
        setNewReport({
          title: "",
          description: "",
          priority: "medium",
          attachments: [],
        });

        // Frissítjük a bejelentések listáját
        loadTruckReports(selectedTruck.id);
      } else {
        throw new Error(result?.message || "Bejelentés elküldése sikertelen");
      }
    } catch (error) {
      alert(error.message);
    }
  };

  // Kijelentkezés
  const handleLogout = () => {
    sessionStorage.removeItem("user");
    history.push("/login");
  };

  // Dátum formázás
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("hu-HU");
  };

  // Dokumentum lejárat státusz
  const getDocumentStatus = (expiryDate) => {
    if (!expiryDate) return "unknown";
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return "expired";
    if (daysUntilExpiry <= 30) return "warning";
    if (daysUntilExpiry <= 90) return "info";
    return "valid";
  };

  // Státusz szín
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "resolved":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Prioritás szín
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Dokumentum státusz szín
  const getDocStatusColor = (status) => {
    switch (status) {
      case "expired":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-orange-100 text-orange-800";
      case "info":
        return "bg-yellow-100 text-yellow-800";
      case "valid":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Szűrők törlése
  const clearFilters = () => {
    setSearchTerm("");
    setDateRange({ start: "", end: "" });
    setReportType("all");
  };

  // Kamion görgetés vezérlői
  const handleTruckScroll = (direction) => {
    if (direction === "up") {
      setTruckScrollIndex((prev) => Math.max(0, prev - 1));
    } else {
      setTruckScrollIndex((prev) => Math.min(trucks.length - 2, prev + 1));
    }
  };

  // Pótkocsi görgetés vezérlői
  const handleTrailerScroll = (direction) => {
    if (direction === "up") {
      setTrailerScrollIndex((prev) => Math.max(0, prev - 1));
    } else {
      setTrailerScrollIndex((prev) => Math.min(porkocsi.length - 2, prev + 1));
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Betöltés...</p>
        </div>
      </div>
    );
  }

  // Látható kamionok kiszámítása
  const visibleTrucks = trucks.slice(truckScrollIndex, truckScrollIndex + 2);

  // Látható pótkocsik kiszámítása
  const visibleTrailers = porkocsi.slice(
    trailerScrollIndex,
    trailerScrollIndex + 2,
  );

  return (
    <div className="h-screen bg-sand-50 overflow-hidden flex flex-col">
      {/* Kompakt fejléc */}
      <header className="bg-white border-b border-ink-100 shrink-0">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-display text-sm font-bold text-white shadow-soft">
                ST
              </span>
              <h1 className="font-display text-[15px] font-bold tracking-tight text-brand-900">
                Szikora <span className="text-brand-500">Transz</span>
              </h1>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <p className="text-[11px] uppercase tracking-wide text-ink-400">Bejelentkezve mint</p>
                <p className="text-sm font-semibold text-brand-900">{user.name}</p>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center rounded-xl border border-ink-100 px-3 py-1.5 text-sm text-ink-600 transition-all duration-300 ease-fluid hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-300"
                title="Kijelentkezés"
              >
                <FaSignOutAlt className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Kijelentkezés</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Bal oldali panel - Felhasználó és kamionok */}
          <div className="lg:col-span-1 space-y-6 h-full overflow-y-auto">
            {/* Felhasználói kártya */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-gray-50">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <FaUser className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <h2 className="text-base font-semibold text-gray-900">
                      {user.name}
                    </h2>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {!isEditing ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <FaPhone className="h-3 w-3 mr-1" />
                          Telefon
                        </div>
                        <p className="text-gray-900">{userData.phone || "-"}</p>
                      </div>

                      <div>
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <FaHome className="h-3 w-3 mr-1" />
                          Lakcím
                        </div>
                        <p className="text-gray-900 text-sm">
                          {userData.lakcim || "-"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <FaBirthdayCake className="h-3 w-3 mr-1" />
                        Születési dátum
                      </div>
                      <p className="text-gray-900">
                        {formatDate(userData.szul_datum) || "-"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <FaIdCard className="h-3 w-3 mr-1" />
                          Személyi
                        </div>
                        <div className="flex items-center">
                          <p className="text-gray-900">
                            {userData.szemelyi || "-"}
                          </p>
                          {userData.szemelyi_lejarat && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${getDocStatusColor(
                                getDocumentStatus(userData.szemelyi_lejarat),
                              )}`}
                            >
                              {formatDate(userData.szemelyi_lejarat)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center text-sm text-gray-500 mb-1">
                          <FaKey className="h-3 w-3 mr-1" />
                          Jogsi
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-900">-</span>
                          {userData.jogsi_lejarat && (
                            <span
                              className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${getDocStatusColor(
                                getDocumentStatus(userData.jogsi_lejarat),
                              )}`}
                            >
                              {formatDate(userData.jogsi_lejarat)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full mt-4 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                    >
                      <FaEdit className="inline mr-2 h-3 w-3" />
                      Adatok szerkesztése
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Név
                      </label>
                      <input
                        type="text"
                        value={userData.name || ""}
                        onChange={(e) =>
                          setUserData({ ...userData, name: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={userData.email || ""}
                        onChange={(e) =>
                          setUserData({ ...userData, email: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Telefon
                      </label>
                      <input
                        type="tel"
                        value={userData.phone || ""}
                        onChange={(e) =>
                          setUserData({ ...userData, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Lakcím
                      </label>
                      <input
                        type="text"
                        value={userData.lakcim || ""}
                        onChange={(e) =>
                          setUserData({ ...userData, lakcim: e.target.value })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Születési dátum
                      </label>
                      <input
                        type="date"
                        value={userData.szul_datum || ""}
                        onChange={(e) =>
                          setUserData({
                            ...userData,
                            szul_datum: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Személyi lejárat
                        </label>
                        <input
                          type="date"
                          value={userData.szemelyi_lejarat || ""}
                          onChange={(e) =>
                            setUserData({
                              ...userData,
                              szemelyi_lejarat: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Jogsi lejárat
                        </label>
                        <input
                          type="date"
                          value={userData.jogsi_lejarat || ""}
                          onChange={(e) =>
                            setUserData({
                              ...userData,
                              jogsi_lejarat: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={handleSaveUserData}
                        disabled={isSaving}
                        className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <FaSave className="h-3 w-3 mr-1" />
                        {isSaving ? "Mentés..." : "Mentés"}
                      </button>

                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setUserData(user);
                        }}
                        className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500"
                      >
                        <FaTimes className="h-3 w-3 mr-1" />
                        Mégse
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Kamion választó */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <FaTruck className="h-4 w-4 mr-2 text-gray-500" />
                  Kamionok ({trucks.length})
                </h3>
                {trucks.length > 2 && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleTruckScroll("up")}
                      disabled={truckScrollIndex === 0}
                      className={`p-1 rounded ${
                        truckScrollIndex === 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <FaChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleTruckScroll("down")}
                      disabled={truckScrollIndex >= trucks.length - 2}
                      className={`p-1 rounded ${
                        truckScrollIndex >= trucks.length - 2
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <FaChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                {visibleTrucks.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nincs hozzárendelt kamion
                  </p>
                ) : (
                  visibleTrucks.map((truck) => (
                    <button
                      key={truck.id}
                      onClick={() => setSelectedTruck(truck)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${
                        selectedTruck?.id === truck.id
                          ? "bg-blue-50 border border-blue-200 shadow-sm"
                          : "border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {truck.rendszam}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {truck.tipus}
                          </div>
                        </div>
                        {selectedTruck?.id === truck.id && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 mt-1"></span>
                        )}
                      </div>

                      {truck.sofor && (
                        <div className="mt-2 text-xs text-gray-600">
                          <FaUser className="inline h-3 w-3 mr-1" />
                          {truck.sofor}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Pótkocsi választó */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                  <FaTrailer className="h-4 w-4 mr-2 text-gray-500" />
                  Pótkocsik ({porkocsi.length})
                </h3>
                {porkocsi.length > 2 && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleTrailerScroll("up")}
                      disabled={trailerScrollIndex === 0}
                      className={`p-1 rounded ${
                        trailerScrollIndex === 0
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <FaChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleTrailerScroll("down")}
                      disabled={trailerScrollIndex >= porkocsi.length - 2}
                      className={`p-1 rounded ${
                        trailerScrollIndex >= porkocsi.length - 2
                          ? "text-gray-300 cursor-not-allowed"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <FaChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3 max-h-[220px] overflow-y-auto">
                {visibleTrailers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nincs hozzárendelt pótkocsi
                  </p>
                ) : (
                  visibleTrailers.map((trailer) => (
                    <button
                      key={trailer.id}
                      onClick={() => setSelectedPorkocsi(trailer)}
                      className={`w-full text-left p-3 rounded-lg transition-all duration-150 ${
                        selectedPorkocsi?.id === trailer.id
                          ? "bg-blue-50 border border-blue-200 shadow-sm"
                          : "border border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {trailer.rendszam}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {trailer.tipus}
                          </div>
                        </div>
                        {selectedPorkocsi?.id === trailer.id && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 mt-1"></span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Jobb oldali panel - Fő tartalom */}
          <div className="lg:col-span-3 space-y-6 overflow-hidden flex flex-col">
            {/* Kamion információk és vezérlők */}
            {selectedTruck ? (
              <>
                {/* Kamion fejléc */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 shrink-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center">
                        <FaTruck className="h-5 w-5 text-blue-600 mr-3" />
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            {selectedTruck.rendszam}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">
                              {selectedTruck.tipus}
                            </span>
                            {selectedTruck.km && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full">
                                {selectedTruck.km.toLocaleString()} km
                              </span>
                            )}
                            {selectedTruck.sofor && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                {selectedTruck.sofor}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowNewReportModal(true)}
                      className="flex items-center justify-center px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 transition-colors"
                    >
                      <FaPlus className="h-4 w-4 mr-2" />
                      Új bejelentés
                    </button>
                  </div>
                </div>

                {/* Szűrők */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 shrink-0">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Bejelentések
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {filteredReports.length} bejelentés
                        {activeFilters > 0 && ` (${activeFilters} szűrő aktív)`}
                      </p>
                    </div>

                    {activeFilters > 0 && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                      >
                        <FaTrash className="h-3 w-3 mr-1" />
                        Szűrők törlése
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-700 mb-1">
                        Szöveg
                      </label>
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Keresés bejelentésekben..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs text-gray-700 mb-1">
                        Dátumtól
                      </label>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) =>
                          setDateRange({ ...dateRange, start: e.target.value })
                        }
                        className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-xs text-gray-700 mb-1">
                        Dátumig
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) =>
                            setDateRange({ ...dateRange, end: e.target.value })
                          }
                          className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-700 mb-1">
                        Bejelentések
                      </label>
                      <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="all">Összes</option>
                        <option value="own">Saját</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bejelentések lista */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex-1 overflow-y-auto">
                  {filteredReports.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <FaExclamationCircle className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-3 text-gray-500">
                        Nincs megjeleníthető bejelentés.
                      </p>
                      {activeFilters > 0 && (
                        <button
                          onClick={clearFilters}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                        >
                          Szűrők törlése
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredReports.map((report) => (
                        <div
                          key={report.id}
                          className="p-5 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                                    report.userId === user?.id
                                      ? "bg-blue-100"
                                      : "bg-gray-100"
                                  }`}
                                >
                                  <FaUser
                                    className={`h-4 w-4 ${
                                      report.userId === user?.id
                                        ? "text-blue-600"
                                        : "text-gray-600"
                                    }`}
                                  />
                                </div>

                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">
                                      {report.title}
                                    </h4>
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded-full border ${getPriorityColor(
                                        report.priority,
                                      )}`}
                                    >
                                      {report.priority === "high"
                                        ? "Magas"
                                        : report.priority === "medium"
                                          ? "Közepes"
                                          : "Alacsony"}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                                        report.status,
                                      )}`}
                                    >
                                      {report.status === "pending"
                                        ? "Függőben"
                                        : report.status === "in_progress"
                                          ? "Folyamatban"
                                          : "Megoldva"}
                                    </span>
                                  </div>

                                  <p className="text-sm text-gray-600 mb-2">
                                    {report.description}
                                  </p>

                                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                    <span className="flex items-center">
                                      <FaUser className="h-3 w-3 mr-1" />
                                      {report.userName || "Ismeretlen"}
                                      {report.userId === user?.id && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">
                                          Saját
                                        </span>
                                      )}
                                    </span>
                                    <span className="flex items-center">
                                      <FaCalendar className="h-3 w-3 mr-1" />
                                      {formatDate(report.date)}{" "}
                                      {report.time && `• ${report.time}`}
                                    </span>
                                  </div>

                                  {report.attachments &&
                                    report.attachments.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-gray-100">
                                        <div className="flex flex-wrap gap-2">
                                          {report.attachments.map(
                                            (attachment, index) => (
                                              <a
                                                key={index}
                                                href={attachment.path}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs rounded-md border border-gray-200 transition-colors"
                                              >
                                                {attachment.type?.startsWith(
                                                  "image/",
                                                ) ? (
                                                  <FaImage className="h-3 w-3 mr-1.5" />
                                                ) : (
                                                  <FaFilePdf className="h-3 w-3 mr-1.5" />
                                                )}
                                                {attachment.name}
                                              </a>
                                            ),
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Ha nincs kamion kiválasztva */
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center flex-1 flex items-center justify-center">
                <div>
                  <FaTruck className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nincs kiválasztott kamion
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Válasszon egy kamiont a bal oldali listából a bejelentések
                    megtekintéséhez.
                  </p>
                  {trucks.length === 0 && (
                    <p className="text-sm text-gray-400">
                      Nincs Önhöz rendelt kamion.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Új bejelentés modal */}
      {showNewReportModal && selectedTruck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Új bejelentés
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Kamion:{" "}
                    <span className="font-semibold">
                      {selectedTruck.rendszam}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setShowNewReportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <FaTimes className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Cím <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newReport.title}
                    onChange={(e) =>
                      setNewReport({ ...newReport, title: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Rövid leírás a problémáról"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Részletes leírás <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newReport.description}
                    onChange={(e) =>
                      setNewReport({
                        ...newReport,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 h-40"
                    placeholder="Írja le részletesen a problémát, jelzést vagy javaslatot..."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Prioritás
                    </label>
                    <select
                      value={newReport.priority}
                      onChange={(e) =>
                        setNewReport({ ...newReport, priority: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="low">Alacsony prioritás</option>
                      <option value="medium">Közepes prioritás</option>
                      <option value="high">Magas prioritás</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Csatolmányok
                      {uploadingFiles && (
                        <span className="ml-2 text-sm text-yellow-600 font-normal">
                          (Feltöltés folyamatban...)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files);
                          const uploaded = await handleFileUpload(files);
                          setNewReport({
                            ...newReport,
                            attachments: [
                              ...newReport.attachments,
                              ...uploaded,
                            ],
                          });
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 cursor-pointer"
                        disabled={uploadingFiles}
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <FaFileUpload className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Támogatott formátumok: Képek (JPG, PNG), PDF, Word
                    </p>
                  </div>
                </div>

                {newReport.attachments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Csatolt fájlok
                    </label>
                    <div className="space-y-2">
                      {newReport.attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center">
                            {file.type?.startsWith("image/") ? (
                              <FaImage className="h-4 w-4 text-blue-600 mr-3" />
                            ) : (
                              <FaFilePdf className="h-4 w-4 text-red-600 mr-3" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newAttachments = [...newReport.attachments];
                              newAttachments.splice(index, 1);
                              setNewReport({
                                ...newReport,
                                attachments: newAttachments,
                              });
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <FaTimes className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowNewReportModal(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleSubmitReport}
                  disabled={
                    !newReport.title.trim() ||
                    !newReport.description.trim() ||
                    uploadingFiles
                  }
                  className="px-5 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Bejelentés elküldése
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
