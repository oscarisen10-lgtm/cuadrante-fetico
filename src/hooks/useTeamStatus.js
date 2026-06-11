import { useState, useEffect } from 'react';
import { getTeamMembers } from '../services/firebaseService';

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
        const members = await getTeamMembers(user.company, user.store, user.section);
        
        // Conditions:
        // 1. More than 1 person in the section (someone else exists)
        // 2. At least 1 person is a boss (Jefe, Segundo, Gestor, Coordinador)
        const hasOtherPeople = members.length > 1;
        const hasBoss = members.some(m => m.rank && m.rank.match(/.*(jefe|segundo|gestor|coordinador).*/i));

        const isValid = hasOtherPeople && hasBoss;

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
