import React, { useState, useEffect, useCallback } from 'react';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { MunicipalDashboard } from './components/MunicipalDashboard';
import { WaterDataSimulator } from './utils/waterDataSimulator';
import { anomalyDetection } from './services/anomalyDetection';
import { pwaService } from './services/pwaService';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { HouseholdProfile, Alert, Contractor, WaterUsageReading, User, ServiceRequest } from './types';

// Sample data
const sampleHousehold: HouseholdProfile = {
  id: 'household-1',
  address: '123 Main Road, Observatory',
  suburb: 'Observatory',
  ward: 3,
  meterId: 'WM-2024-001',
  accountNumber: 'ACC-789456123',
  occupants: 4,
  propertyType: 'residential',
  averageDailyUsage: 300,
  baselineUsage: 2.5, // gallons per 5-min interval
  alertPreferences: {
    enablePushNotifications: true,
    enableSMSAlerts: true,
    enableEmailAlerts: true,
    leakThreshold: 200, // 200% increase
    continuousFlowMinutes: 30
  },
  ratesAccount: {
    currentBalance: -2450.00,
    lastPayment: new Date('2024-01-15'),
    paymentStatus: 'current'
  }
};

const sampleContractors: Contractor[] = [
  {
    id: '1',
    name: 'Mike Rodriguez',
    company: 'AquaFix Pro (Pty) Ltd',
    specialty: ['Leak Detection', 'Pipe Repair', 'Emergency Service'],
    rating: 4.9,
    reviewCount: 127,
    responseTime: 'Within 2 hours',
    serviceArea: ['Observatory', 'Woodstock', 'Salt River'],
    phone: '(555) 123-4567',
    email: 'mike@aquafixpro.co.za',
    available24h: true,
    emergencyService: true,
    certifications: ['Licensed Plumber', 'Leak Detection Specialist'],
    yearsExperience: 12,
    beeLevel: 'Level 2',
    cidbRegistration: 'CIDB-12345'
  },
  {
    id: '2',
    name: 'Sarah Chen',
    company: 'WaterWorks Solutions CC',
    specialty: ['System Installation', 'Pressure Regulation', 'Smart Meters'],
    rating: 4.8,
    reviewCount: 89,
    responseTime: 'Same day',
    serviceArea: ['Rondebosch', 'Claremont', 'Wynberg'],
    phone: '(555) 987-6543',
    email: 'sarah@waterworkssolutions.co.za',
    available24h: false,
    emergencyService: true,
    certifications: ['Master Plumber', 'Smart Systems Certified'],
    yearsExperience: 8,
    beeLevel: 'Level 4'
  },
  {
    id: '3',
    name: 'Tom Anderson',
    company: 'Rapid Response Plumbing (Pty) Ltd',
    specialty: ['Emergency Repairs', 'Burst Pipes', 'Water Damage'],
    rating: 4.7,
    reviewCount: 156,
    responseTime: 'Within 1 hour',
    serviceArea: ['Goodwood', 'Parow', 'Bellville'],
    phone: '(555) 456-7890',
    email: 'tom@rapidresponseplumbing.co.za',
    available24h: true,
    emergencyService: true,
    certifications: ['Emergency Response Certified', 'Water Damage Specialist'],
    yearsExperience: 15,
    beeLevel: 'Level 1',
    cidbRegistration: 'CIDB-67890'
  },
  {
    id: '4',
    name: 'Lisa Park',
    company: 'EcoFlow Systems CC',
    specialty: ['Water Conservation', 'Smart Monitoring', 'System Optimization'],
    rating: 4.9,
    reviewCount: 73,
    responseTime: 'Within 4 hours',
    serviceArea: ['Mowbray', 'Observatory', 'Woodstock'],
    phone: '(555) 234-5678',
    email: 'lisa@ecoflowsystems.co.za',
    available24h: false,
    emergencyService: false,
    certifications: ['Water Efficiency Expert', 'Smart Home Integration'],
    yearsExperience: 6,
    beeLevel: 'Level 3'
  }
];

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [simulator] = useState(() => new WaterDataSimulator(sampleHousehold));
  const [readings, setReadings] = useState<WaterUsageReading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [isLeakActive, setIsLeakActive] = useState(false);

  // Check authentication on app load
  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user && authService.isUserAuthenticated()) {
      setCurrentUser(user);
      setIsAuthenticated(true);
    }
  }, []);

  // Initialize app data
  useEffect(() => {
    const initializeData = async () => {
      // Load initial readings
      const initialReadings = simulator.getAllReadings();
      setReadings(initialReadings);
      
      // Generate service requests
      const initialServiceRequests = simulator.generateServiceRequests();
      setServiceRequests(initialServiceRequests);
      
      // Save to storage
      try {
        for (const reading of initialReadings) {
          await storageService.store('readings', reading);
        }
        await storageService.store('households', sampleHousehold);
        for (const contractor of sampleContractors) {
          await storageService.store('contractors', contractor);
        }
        for (const request of initialServiceRequests) {
          await storageService.store('serviceRequests', request);
        }
      } catch (error) {
        console.warn('Storage error, using localStorage fallback:', error);
        storageService.setLocal('readings', initialReadings);
        storageService.setLocal('household', sampleHousehold);
        storageService.setLocal('contractors', sampleContractors);
        storageService.setLocal('serviceRequests', initialServiceRequests);
      }
    };

    initializeData();
  }, [simulator]);

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      const newReading = simulator.generateRealtimeReading();
      setReadings(prev => [...prev, newReading]);
      
      // Detect anomalies
      const newAlerts = anomalyDetection.detectAnomalies([...readings, newReading], sampleHousehold);
      if (newAlerts.length > 0) {
        setAlerts(prev => [...prev, ...newAlerts]);
        
        // Trigger push notification for critical alerts
        newAlerts.forEach(alert => {
          if (alert.severity === 'high' || alert.severity === 'critical') {
            pwaService.triggerLeakAlert();
          }
        });
      }
      
      // Store reading
      try {
        storageService.store('readings', newReading);
      } catch (error) {
        console.warn('Storage error:', error);
      }
    }, 5000); // Update every 5 seconds for demo

    return () => clearInterval(interval);
  }, [simulator, readings]);

  const handleSimulateLeak = useCallback(() => {
    simulator.simulateLeak();
    setIsLeakActive(true);
  }, [simulator]);

  const handleStopLeak = useCallback(() => {
    simulator.stopLeak();
    setIsLeakActive(false);
  }, [simulator]);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    simulator.acknowledgeAlert(alertId);
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  }, [simulator]);

  const handleResolveAlert = useCallback((alertId: string) => {
    simulator.resolveAlert(alertId);
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  }, [simulator]);

  const handleContactContractor = useCallback((contractor: Contractor) => {
    // In a real app, this would open a contact form or initiate communication
    const subject = encodeURIComponent('Water System Service Request - Ecosphere Connect');
    const body = encodeURIComponent(
      `Hello ${contractor.name},\n\nI found your contact through Ecosphere Connect and would like to request service for my water system at ${sampleHousehold.address}.\n\nPlease contact me at your earliest convenience.\n\nThank you!`
    );
    
    window.open(`mailto:${contractor.email}?subject=${subject}&body=${body}`, '_blank');
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleUpdateServiceRequest = useCallback((requestId: string, updates: Partial<ServiceRequest>) => {
    setServiceRequests(prev => prev.map(request => 
      request.id === requestId ? { ...request, ...updates } : request
    ));
  }, []);

  // Show login form if not authenticated
  if (!isAuthenticated || !currentUser) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  const municipalData = simulator.getMunicipalData();

  // Show appropriate dashboard based on user role
  if (currentUser.role === 'municipal_officer' || currentUser.role === 'municipal_admin') {
    return (
      <MunicipalDashboard
        user={currentUser}
        readings={readings}
        alerts={alerts}
        serviceRequests={serviceRequests}
        municipalData={municipalData}
        onUpdateServiceRequest={handleUpdateServiceRequest}
        onLogout={handleLogout}
      />
    );
  }

  // Default resident/contractor dashboard
  return (
    <Dashboard
      user={currentUser}
      readings={readings}
      alerts={alerts}
      contractors={sampleContractors}
      serviceRequests={serviceRequests}
      municipalData={municipalData}
      onAcknowledgeAlert={handleAcknowledgeAlert}
      onResolveAlert={handleResolveAlert}
      onContactContractor={handleContactContractor}
      onUpdateServiceRequest={handleUpdateServiceRequest}
      onSimulateLeak={handleSimulateLeak}
      onStopLeak={handleStopLeak}
      isLeakActive={isLeakActive}
      onLogout={handleLogout}
    />
  );
}

export default App;