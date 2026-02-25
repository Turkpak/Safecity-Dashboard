// Mock installation data for all Punjab administrative units
// Division -> District -> Tehsil -> Cities

import { PUNJAB_HIERARCHY } from './punjabHierarchy';
import { getTehsilSubProjectsByPhase, getBahawalpurTehsilProjects } from './bahawalpurProjectsData';

export interface InstallationData {
  surveys: number;
  foundations: number;
  cabinet: number;
  cable: number;
  controlRoom: number;
  ppic3: number;
  overall: number;
}

// Generate random mock data between min and max
export const generateMockData = (min: number = 20, max: number = 100): InstallationData => {
  const surveys = Math.floor(Math.random() * (max - min + 1)) + min;
  const foundations = Math.max(0, surveys - Math.floor(Math.random() * 15 + 5));
  const cabinet = Math.max(0, foundations - Math.floor(Math.random() * 15 + 5));
  const cable = Math.max(0, cabinet - Math.floor(Math.random() * 15 + 5));
  const controlRoom = Math.max(0, cable - Math.floor(Math.random() * 15 + 5));
  const ppic3 = Math.max(0, controlRoom - Math.floor(Math.random() * 15 + 5));
  const overall = Math.round((surveys + foundations + cabinet + cable + controlRoom + ppic3) / 6);
  
  return {
    surveys: Math.min(100, surveys),
    foundations: Math.min(100, foundations),
    cabinet: Math.min(100, cabinet),
    cable: Math.min(100, cable),
    controlRoom: Math.min(100, controlRoom),
    ppic3: Math.min(100, ppic3),
    overall: Math.min(100, overall),
  };
};

// Generate data for all cities in hierarchy
export const generateCityData = (): Record<string, InstallationData> => {
  const data: Record<string, InstallationData> = {};
  
  PUNJAB_HIERARCHY.forEach(division => {
    division.districts.forEach(district => {
      district.tehsils.forEach(tehsil => {
        tehsil.cities.forEach(city => {
          if (city && city.trim() !== '') {
            // Use consistent seed for same city name
            const seed = city.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            Math.seedrandom = Math.seedrandom || ((seed: number) => {
              let value = seed;
              return () => {
                value = (value * 9301 + 49297) % 233280;
                return value / 233280;
              };
            });
            
            // Generate data based on city name (deterministic)
            const random = (seed: number) => {
              const x = Math.sin(seed) * 10000;
              return x - Math.floor(x);
            };
            
            const surveys = Math.floor(random(seed * 100) * 80) + 20;
            const foundations = Math.max(0, surveys - Math.floor(random(seed * 200) * 15 + 5));
            const cabinet = Math.max(0, foundations - Math.floor(random(seed * 300) * 15 + 5));
            const cable = Math.max(0, cabinet - Math.floor(random(seed * 400) * 15 + 5));
            const controlRoom = Math.max(0, cable - Math.floor(random(seed * 500) * 15 + 5));
            const ppic3 = Math.max(0, controlRoom - Math.floor(random(seed * 600) * 15 + 5));
            const overall = Math.round((surveys + foundations + cabinet + cable + controlRoom + ppic3) / 6);
            
            data[city.toLowerCase().replace(/\s+/g, '')] = {
              surveys: Math.min(100, surveys),
              foundations: Math.min(100, foundations),
              cabinet: Math.min(100, cabinet),
              cable: Math.min(100, cable),
              controlRoom: Math.min(100, controlRoom),
              ppic3: Math.min(100, ppic3),
              overall: Math.min(100, overall),
            };
          }
        });
      });
    });
  });
  
  return data;
};

// Pre-generated data for known cities (matching existing data)
export const KNOWN_CITY_DATA: Record<string, InstallationData> = {
  sheikhupura: {
    surveys: 100,
    foundations: 95,
    cabinet: 88,
    cable: 75,
    controlRoom: 60,
    ppic3: 45,
    overall: 77,
  },
  sialkot: {
    surveys: 100,
    foundations: 92,
    cabinet: 85,
    cable: 70,
    controlRoom: 55,
    ppic3: 40,
    overall: 72,
  },
  gujrat: {
    surveys: 100,
    foundations: 88,
    cabinet: 80,
    cable: 65,
    controlRoom: 50,
    ppic3: 35,
    overall: 68,
  },
  jehlum: {
    surveys: 100,
    foundations: 85,
    cabinet: 75,
    cable: 60,
    controlRoom: 45,
    ppic3: 30,
    overall: 66,
  },
  attock: {
    surveys: 100,
    foundations: 82,
    cabinet: 72,
    cable: 55,
    controlRoom: 40,
    ppic3: 25,
    overall: 62,
  },
  hassanabdal: {
    surveys: 100,
    foundations: 78,
    cabinet: 68,
    cable: 50,
    controlRoom: 35,
    ppic3: 20,
    overall: 59,
  },
  sahiwal: {
    surveys: 100,
    foundations: 90,
    cabinet: 82,
    cable: 68,
    controlRoom: 52,
    ppic3: 38,
    overall: 72,
  },
  okara: {
    surveys: 100,
    foundations: 87,
    cabinet: 78,
    cable: 62,
    controlRoom: 48,
    ppic3: 32,
    overall: 68,
  },
  jhang: {
    surveys: 100,
    foundations: 83,
    cabinet: 70,
    cable: 58,
    controlRoom: 42,
    ppic3: 28,
    overall: 64,
  },
  muzaffargarh: {
    surveys: 100,
    foundations: 80,
    cabinet: 65,
    cable: 52,
    controlRoom: 38,
    ppic3: 22,
    overall: 60,
  },
  taxila: {
    surveys: 95,
    foundations: 88,
    cabinet: 78,
    cable: 65,
    controlRoom: 50,
    ppic3: 35,
    overall: 68,
  },
  murree: {
    surveys: 92,
    foundations: 85,
    cabinet: 75,
    cable: 62,
    controlRoom: 48,
    ppic3: 32,
    overall: 66,
  },
  sargodha: {
    surveys: 98,
    foundations: 90,
    cabinet: 82,
    cable: 70,
    controlRoom: 55,
    ppic3: 40,
    overall: 73,
  },
  mianwali: {
    surveys: 95,
    foundations: 87,
    cabinet: 78,
    cable: 65,
    controlRoom: 50,
    ppic3: 35,
    overall: 68,
  },
  faisalabad: {
    surveys: 100,
    foundations: 93,
    cabinet: 85,
    cable: 72,
    controlRoom: 58,
    ppic3: 42,
    overall: 75,
  },
  multan: {
    surveys: 97,
    foundations: 89,
    cabinet: 80,
    cable: 68,
    controlRoom: 53,
    ppic3: 38,
    overall: 71,
  },
  bahawalpur: {
    surveys: 94,
    foundations: 86,
    cabinet: 77,
    cable: 64,
    controlRoom: 49,
    ppic3: 34,
    overall: 68,
  },
  ryk: {
    surveys: 91,
    foundations: 83,
    cabinet: 74,
    cable: 61,
    controlRoom: 46,
    ppic3: 31,
    overall: 64,
  },
  dgkhan: {
    surveys: 89,
    foundations: 81,
    cabinet: 72,
    cable: 59,
    controlRoom: 44,
    ppic3: 29,
    overall: 62,
  },
  lahore: {
    surveys: 100,
    foundations: 96,
    cabinet: 90,
    cable: 80,
    controlRoom: 65,
    ppic3: 50,
    overall: 82,
  },
  rawalpindi: {
    surveys: 98,
    foundations: 91,
    cabinet: 83,
    cable: 72,
    controlRoom: 58,
    ppic3: 43,
    overall: 74,
  },
};

// Generate data for all administrative units
export const getAllDivisionData = (): Record<string, InstallationData> => {
  const data: Record<string, InstallationData> = {};
  
  PUNJAB_HIERARCHY.forEach(division => {
    const allCities: InstallationData[] = [];
    
    division.districts.forEach(district => {
      district.tehsils.forEach(tehsil => {
        tehsil.cities.forEach(city => {
          if (city && city.trim() !== '') {
            const cityKey = city.toLowerCase().replace(/\s+/g, '');
            const cityData = KNOWN_CITY_DATA[cityKey] || generateMockData();
            allCities.push(cityData);
          }
        });
      });
    });
    
    if (allCities.length > 0) {
      data[division.division.toLowerCase().replace(/\s+/g, '')] = {
        surveys: Math.round(allCities.reduce((sum, c) => sum + c.surveys, 0) / allCities.length),
        foundations: Math.round(allCities.reduce((sum, c) => sum + c.foundations, 0) / allCities.length),
        cabinet: Math.round(allCities.reduce((sum, c) => sum + c.cabinet, 0) / allCities.length),
        cable: Math.round(allCities.reduce((sum, c) => sum + c.cable, 0) / allCities.length),
        controlRoom: Math.round(allCities.reduce((sum, c) => sum + c.controlRoom, 0) / allCities.length),
        ppic3: Math.round(allCities.reduce((sum, c) => sum + c.ppic3, 0) / allCities.length),
        overall: Math.round(allCities.reduce((sum, c) => sum + c.overall, 0) / allCities.length),
      };
    } else {
      // Generate mock data for division if no cities
      data[division.division.toLowerCase().replace(/\s+/g, '')] = generateMockData(40, 90);
    }
  });
  
  return data;
};

export const getAllDistrictData = (): Record<string, InstallationData> => {
  const data: Record<string, InstallationData> = {};
  
  PUNJAB_HIERARCHY.forEach(division => {
    division.districts.forEach(district => {
      const allCities: InstallationData[] = [];
      
      district.tehsils.forEach(tehsil => {
        tehsil.cities.forEach(city => {
          if (city && city.trim() !== '') {
            const cityKey = city.toLowerCase().replace(/\s+/g, '');
            const cityData = KNOWN_CITY_DATA[cityKey] || generateMockData();
            allCities.push(cityData);
          }
        });
      });
      
      const key = `${division.division}-${district.district}`.toLowerCase().replace(/\s+/g, '');
      if (allCities.length > 0) {
        data[key] = {
          surveys: Math.round(allCities.reduce((sum, c) => sum + c.surveys, 0) / allCities.length),
          foundations: Math.round(allCities.reduce((sum, c) => sum + c.foundations, 0) / allCities.length),
          cabinet: Math.round(allCities.reduce((sum, c) => sum + c.cabinet, 0) / allCities.length),
          cable: Math.round(allCities.reduce((sum, c) => sum + c.cable, 0) / allCities.length),
          controlRoom: Math.round(allCities.reduce((sum, c) => sum + c.controlRoom, 0) / allCities.length),
          ppic3: Math.round(allCities.reduce((sum, c) => sum + c.ppic3, 0) / allCities.length),
          overall: Math.round(allCities.reduce((sum, c) => sum + c.overall, 0) / allCities.length),
        };
      } else {
        data[key] = generateMockData(35, 85);
      }
    });
  });
  
  return data;
};

export const getAllTehsilData = (): Record<string, InstallationData> => {
  const data: Record<string, InstallationData> = {};
  
  PUNJAB_HIERARCHY.forEach(division => {
    division.districts.forEach(district => {
      district.tehsils.forEach(tehsil => {
        const key = `${division.division}-${district.district}-${tehsil.tehsil}`.toLowerCase().replace(/\s+/g, '');
        
        // Check if this is a Bahawalpur division tehsil with real project data
        if (division.division === 'Bahawalpur') {
          try {
            const projects = getBahawalpurTehsilProjects(district.district, tehsil.tehsil);
            
            if (projects && projects.length > 0) {
              // Use real project data from Excel
              const subProjectsByPhase = getTehsilSubProjectsByPhase(district.district, tehsil.tehsil);
              
              // Calculate progress for each phase based on sub-projects
              const calculatePhaseProgress = (phaseKey: string): number => {
                const subProjects = subProjectsByPhase[phaseKey] || [];
                if (subProjects.length === 0) return 0;
                
                const totalWeight = subProjects.reduce((sum, sp) => sum + sp.weight, 0);
                if (totalWeight === 0) return 0;
                
                const weightedProgress = subProjects.reduce((sum, sp) => 
                  sum + (sp.actualProgress * sp.weight), 0
                );
                
                return Math.round(weightedProgress / totalWeight);
              };
              
              const surveys = calculatePhaseProgress('surveys');
              const foundations = calculatePhaseProgress('foundations');
              const cabinet = calculatePhaseProgress('cabinet');
              const cable = calculatePhaseProgress('cable');
              const controlRoom = calculatePhaseProgress('controlRoom');
              const ppic3 = calculatePhaseProgress('ppic3');
              const overall = Math.round((surveys + foundations + cabinet + cable + controlRoom + ppic3) / 6);
              
              data[key] = {
                surveys,
                foundations,
                cabinet,
                cable,
                controlRoom,
                ppic3,
                overall,
              };
              
              // Continue to next tehsil
              return;
            }
          } catch (error) {
            console.warn(`Error loading Bahawalpur data for ${district.district}-${tehsil.tehsil}:`, error);
            // Fall through to default data generation
          }
        }
        
        // Default data generation for non-Bahawalpur or tehsils without project data
        const allCities: InstallationData[] = [];
        
        tehsil.cities.forEach(city => {
          if (city && city.trim() !== '') {
            const cityKey = city.toLowerCase().replace(/\s+/g, '');
            const cityData = KNOWN_CITY_DATA[cityKey] || generateMockData();
            allCities.push(cityData);
          }
        });
        
        if (allCities.length > 0) {
          data[key] = {
            surveys: Math.round(allCities.reduce((sum, c) => sum + c.surveys, 0) / allCities.length),
            foundations: Math.round(allCities.reduce((sum, c) => sum + c.foundations, 0) / allCities.length),
            cabinet: Math.round(allCities.reduce((sum, c) => sum + c.cabinet, 0) / allCities.length),
            cable: Math.round(allCities.reduce((sum, c) => sum + c.cable, 0) / allCities.length),
            controlRoom: Math.round(allCities.reduce((sum, c) => sum + c.controlRoom, 0) / allCities.length),
            ppic3: Math.round(allCities.reduce((sum, c) => sum + c.ppic3, 0) / allCities.length),
            overall: Math.round(allCities.reduce((sum, c) => sum + c.overall, 0) / allCities.length),
          };
        } else {
          data[key] = generateMockData(30, 80);
        }
      });
    });
  });
  
  return data;
};

