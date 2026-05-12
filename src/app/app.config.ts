import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { routes } from './app.routes';

const firebaseConfig = {
  apiKey: "AIzaSyD4uNL-l6769mjmAkygcj_lSKrBCFWP7N0",
  authDomain: "setu-proyecto-f967e.firebaseapp.com",
  projectId: "setu-proyecto-f967e",
  storageBucket: "setu-proyecto-f967e.firebasestorage.app",
  messagingSenderId: "511563715616",
  appId: "1:511563715616:web:84ab5b3b194a75db809845",
  measurementId: "G-JM6VP4H0X3"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimations(),
    provideToastr({
      timeOut: 2500,
      positionClass: 'toast-bottom-right',
      preventDuplicates: true
    }),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth())
  ]
};