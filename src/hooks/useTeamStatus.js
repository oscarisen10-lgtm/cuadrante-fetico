import { useState, useEffect } from 'react';
import { fetchTeamStatus } from '../services/firebaseService';

export const useTeamStatus = (user) => {
  const [canRequestOff, setCanRequestOff] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      if (!user || !user.company || !user.store || !user.section || user.section === "Sin especificar") {
        if (isMounted) {
          setCanRequestOff(false);
          setIsLoadingStatus(false);
        }
        return;
      }

      const cacheKey = `canRequestOff_${user.company}_${user.store}_${user.section}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // Cache validity: 12 hours
          if (Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000) {
            if (isMounted) {
              setCanRequestOff(parsed.value);
              setIsLoadingStatus(false);
            }
            return;
          }
        } catch (e) {
          // ignore cache errors
        }
      }

      try {
        // El servidor calcula las cifras (el cliente ya no lee perfiles ajenos).
        // canRequestOff = hay alguien más en la sección Y al menos un responsable.
        const data = await fetchTeamStatus({
          company: user.company,
          store: user.store,
          section: user.section,
        });
        const isValid = !!data?.canRequestOff;

        localStorage.setItem(cacheKey, JSON.stringify({
          value: isValid,
          timestamp: Date.now()
        }));

        if (isMounted) {
          setCanRequestOff(isValid);
          setIsLoadingStatus(false);
        }
      } catch (error) {
        console.error("Error checking team status:", error);
        if (isMounted) {
          setCanRequestOff(false);
          setIsLoadingStatus(false);
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [user?.company, user?.store, user?.section]);

  return { canRequestOff, isLoadingStatus };
};
