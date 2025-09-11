import { Route } from '@angular/router';
import { chunkRoutes } from './chunk.routes';

export const rootChunkerRoutes: Route[] = [
    {
        path: '',
        loadComponent: () => import('./root-chunker.component').then(m => m.RootChunkerComponent),
        children: chunkRoutes
    }
];
