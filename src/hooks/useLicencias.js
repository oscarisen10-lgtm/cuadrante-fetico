import { useState, useEffect } from 'react';
import { subscribeToLicencias, addLicencia as apiAddLicencia, updateLicencia as apiUpdateLicencia, deleteLicencia as apiDeleteLicencia } from '../services/firebaseService';

export const useLicencias = () => {
  const [licenciasList, setLicenciasList] = useState([]);

  useEffect(() => {
    const unsubLicencias = subscribeToLicencias((arr) => {
      setLicenciasList(arr);
    });
    return () => unsubLicencias();
  }, []);

  const addLicencia = async (data) => await apiAddLicencia(data);
  const updateLicencia = async (id, data) => await apiUpdateLicencia(id, data);
  const deleteLicencia = async (id) => await apiDeleteLicencia(id);

  return { licenciasList, addLicencia, updateLicencia, deleteLicencia };
};
