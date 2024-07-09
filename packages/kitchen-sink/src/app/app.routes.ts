import { Route } from '@angular/router';

export const appRoutes: Route[] = [
    {
        path: '1',
        loadComponent: () => import('../shared/feature/feature-1.component')
    },
    {
        path: '2',
        loadComponent: () => import('../shared/feature/feature-2.component')
    },
    {
        path: '3',
        loadComponent: () => import('../shared/feature/feature-3.component')
    }
];
