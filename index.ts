import { registerRootComponent } from 'expo';

// Defines the background task — must run before the app component is registered.
import './src/lib/background';

import App from './App';

registerRootComponent(App);
