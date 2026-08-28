import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMapsLoaderService } from '../../../../core/services/google-maps-loader.service';

declare var google: any;

@Component({
  selector: 'app-dp-order-live-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dp-order-live-map.component.html',
  styleUrl: './dp-order-live-map.component.scss'
})
export class DpOrderLiveMapComponent implements OnInit, OnChanges, OnDestroy {
  @Input() destLat?: number | null;
  @Input() destLng?: number | null;
  @Input() destAddress?: string | null;
  @Input() title = 'Delivery Location';

  @ViewChild('mapContainer', { static: false }) mapContainer?: ElementRef<HTMLDivElement>;

  private mapsLoader = inject(GoogleMapsLoaderService);

  riderLat = signal<number | null>(null);
  riderLng = signal<number | null>(null);
  distanceKm = signal<number | null>(null);
  locationStatus = signal<string>('Acquiring your GPS location…');
  mapLoaded = signal(false);
  errorMsg = signal('');

  private watchId?: number;
  private map?: any;
  private riderMarker?: any;
  private destMarker?: any;
  private directionsService?: any;
  private directionsRenderer?: any;

  ngOnInit() {
    this.startLocationWatch();
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['destLat'] || changes['destLng']) && this.mapLoaded()) {
      this.updateMarkersAndRoute();
    }
  }

  ngOnDestroy() {
    if (this.watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
  }

  private startLocationWatch() {
    if (!navigator.geolocation) {
      this.locationStatus.set('Geolocation is not supported by your device.');
      return;
    }

    // Get current position immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => this.onPositionUpdate(pos.coords.latitude, pos.coords.longitude),
      (err) => this.onPositionError(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    // Watch position continuously
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.onPositionUpdate(pos.coords.latitude, pos.coords.longitude),
      (err) => this.onPositionError(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  private onPositionUpdate(lat: number, lng: number) {
    this.riderLat.set(lat);
    this.riderLng.set(lng);
    this.locationStatus.set('GPS Live Tracking Active');

    if (this.destLat && this.destLng) {
      const dist = this.haversineDistance(lat, lng, this.destLat, this.destLng);
      this.distanceKm.set(Math.round(dist * 10) / 10);
    }

    if (this.mapLoaded()) {
      this.updateMarkersAndRoute();
    }
  }

  private onPositionError(err: GeolocationPositionError) {
    this.locationStatus.set(`GPS Warning: ${err.message}`);
  }

  private initMap() {
    // Attempt Google Maps initialization with fallback
    const key = (window as any).__LE_MAPS_KEY__ || '';
    if (!key && !(window as any).google?.maps) {
      setTimeout(() => this.initLeafletFallback(), 300);
      return;
    }

    this.mapsLoader
      .load(key)
      .then(() => {
        const host = this.mapContainer?.nativeElement;
        if (!host || !window.google?.maps) return;

        const g = window.google;
        const centerLat = this.riderLat() || this.destLat || 25.86;
        const centerLng = this.riderLng() || this.destLng || 85.18;

        this.map = new g.maps.Map(host, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        });

        this.directionsService = new g.maps.DirectionsService();
        this.directionsRenderer = new g.maps.DirectionsRenderer({
          map: this.map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#059669', // Emerald line
            strokeOpacity: 0.9,
            strokeWeight: 6,
          },
        });

        this.mapLoaded.set(true);
        this.updateMarkersAndRoute();
      })
      .catch(() => {
        this.initLeafletFallback();
      });
  }

  private initLeafletFallback() {
    this.mapLoaded.set(true);
  }

  private updateMarkersAndRoute() {
    if (!this.map || !window.google?.maps) return;
    const g = window.google;

    const rLat = this.riderLat();
    const rLng = this.riderLng();

    // Rider marker
    if (rLat != null && rLng != null) {
      const riderPos = { lat: rLat, lng: rLng };
      if (!this.riderMarker) {
        this.riderMarker = new g.maps.Marker({
          map: this.map,
          position: riderPos,
          title: 'You (Delivery Partner)',
          icon: {
            path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: '#059669',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      } else {
        this.riderMarker.setPosition(riderPos);
      }
    }

    // Destination marker
    if (this.destLat != null && this.destLng != null) {
      const destPos = { lat: this.destLat, lng: this.destLng };
      if (!this.destMarker) {
        this.destMarker = new g.maps.Marker({
          map: this.map,
          position: destPos,
          title: this.title,
          icon: {
            path: g.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#dc2626',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
      } else {
        this.destMarker.setPosition(destPos);
      }
    }

    // Route polyline
    if (rLat != null && rLng != null && this.destLat != null && this.destLng != null) {
      if (this.directionsService && this.directionsRenderer) {
        this.directionsService.route(
          {
            origin: { lat: rLat, lng: rLng },
            destination: { lat: this.destLat, lng: this.destLng },
            travelMode: g.maps.TravelMode.DRIVING,
          },
          (res: any, status: any) => {
            if (status === 'OK' && res) {
              this.directionsRenderer!.setDirections(res);
            }
          }
        );
      }
    }
  }

  openGoogleMapsNav() {
    if (this.destLat != null && this.destLng != null) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${this.destLat},${this.destLng}`;
      window.open(url, '_blank');
    }
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
