import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '',
        loadChildren: () => import('../shared/chunkers/root-chunker.routes').then(m => m.rootChunkerRoutes),
    },
];
