import { useState, useEffect, useCallback } from 'react';
import { subscribeToNews, addNews as apiAddNews, deleteNews as apiDeleteNews } from '../services/firebaseService';

export const useNews = () => {
  const [newsList, setNewsList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubNews = subscribeToNews((arr) => {
      setNewsList(arr);
    });
    return () => unsubNews();
  }, []);

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
