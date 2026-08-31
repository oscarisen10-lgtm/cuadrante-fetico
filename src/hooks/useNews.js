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
 *
 * Si el admin le ha cortado las noticias a este usuario, el feed sale vacío.
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
    if (!store) return;
    const unsub = subscribeToStoreNews(store, (arr) => {
      setStoreNews(arr.map((n) => ({ ...n, isStoreNews: true })));
    });
    return () => unsub();
  }, [store]);

  // El admin puede cortarle las noticias a alguien (adminSetNoticias): el push no
  // le sale del servidor y el feed queda vacío aquí. Ojo con lo que esto es y lo
  // que no: el push SÍ está cortado en el servidor, pero el feed lo esconde el
  // cliente — no es un secreto que ocultar, es la misma noticia que ve todo el
  // mundo, así que no se pagan lecturas ni reglas extra por esconderla.
  const mudo = user?.recibeNoticias === false;

  const newsList = useMemo(
    // Sin tienda no se muestran noticias de delegado. Se DERIVA aquí en vez de
    // vaciar storeNews desde el efecto: llamar a setState dentro de un efecto
    // provoca un render en cascada innecesario (react-hooks/set-state-in-effect).
    () => (mudo ? [] : [...globalNews, ...(store ? storeNews : [])]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 40)),
    [globalNews, storeNews, store, mudo]
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
