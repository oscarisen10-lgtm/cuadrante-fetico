import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  subscribeToNews, subscribeToStoreNews,
  addNews as apiAddNews, deleteNews as apiDeleteNews,
} from '../services/firebaseService';

/**
 * useNews — Feed de noticias del usuario: las GLOBALES (las publica solo el
 * admin, para toda la app) + las de SU TIENDA (las publica su delegado en
 * noticiasTienda; los usuarios de otras tiendas ni las ven — lo garantizan las
 * reglas). Se fusionan ordenadas por fecha; las de delegado llevan
 * isStoreNews:true para que el Resumen las etiquete.
 */
export const useNews = (user) => {
  const [globalNews, setGlobalNews] = useState([]);
  const [storeNews, setStoreNews] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubNews = subscribeToNews((arr) => {
      setGlobalNews(arr);
    });
    return () => unsubNews();
  }, []);

  const store = user?.store;
  useEffect(() => {
    if (!store) { setStoreNews([]); return; }
    const unsub = subscribeToStoreNews(store, (arr) => {
      setStoreNews(arr.map((n) => ({ ...n, isStoreNews: true })));
    });
    return () => unsub();
  }, [store]);

  const newsList = useMemo(
    () => [...globalNews, ...storeNews]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 40),
    [globalNews, storeNews]
  );

  const addNews = useCallback(async (newsData) => {
    setIsLoading(true);
    try {
      await apiAddNews({
        ...newsData,
        createdAt: Date.now()
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteNews = useCallback(async (id) => {
    await apiDeleteNews(id);
  }, []);

  return { newsList, addNews, deleteNews, isLoading };
};
