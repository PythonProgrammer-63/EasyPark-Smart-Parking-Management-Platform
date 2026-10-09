import React, { createContext, useContext, useState } from 'react';

const LocationContext = createContext(null);

// Default coordinates centered in a busy metropolitan hub for initial distance calculations
const DEFAULT_COORDS = { lat: 18.5314, lng: 73.8446, name: 'Pune Central (FC Road Hub)' };

export const LocationProvider = ({ children }) => {
  const [coords, setCoords] = useState(DEFAULT_COORDS);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [usingGps, setUsingGps] = useState(false);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Your Current Live Location'
        };
        setCoords(newCoords);
        setUsingGps(true);
        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        setLocationError('Could not retrieve exact GPS. Using city center reference.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const setPresetLocation = (newCoords) => {
    setCoords(newCoords);
    setUsingGps(false);
  };

  return (
    <LocationContext.Provider value={{
      coords,
      isLocating,
      locationError,
      usingGps,
      requestCurrentLocation,
      setPresetLocation,
      lat: coords.lat,
      lng: coords.lng,
      locationName: coords.name
    }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
