import i18n from 'i18next';

const resources = {
  en: {
    translation: {
      "Welcome": "Welcome",
      "Hello": "Hello"
    }
  },
  pt: {
    translation: {
      "Welcome": "Bem-vindo",
      "Hello": "Olá"
    }
  }
};

export const initI18n = async () => {
  const { initReactI18next } = await import('react-i18next');
  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: 'pt',
      fallbackLng: 'pt',
      interpolation: {
        escapeValue: false
      }
    });
};

export default i18n;