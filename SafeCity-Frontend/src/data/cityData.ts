// Shared city installation data for use across components

export interface CityInstallationData {
  surveys: number;
  foundations: number;
  cabinet: number;
  cable: number;
  controlRoom: number;
  ppic3: number;
  overall: number;
  timeline?: {
    month: string;
    surveys: number;
    foundations: number;
    cabinet: number;
    cable: number;
    controlRoom: number;
    ppic3: number;
    overall: number;
  }[];
}

export const CITY_INSTALLATION_DATA: Record<string, CityInstallationData> = {
  sheikhupura: {
    surveys: 100,
    foundations: 95,
    cabinet: 88,
    cable: 75,
    controlRoom: 60,
    ppic3: 45,
    overall: 77,
    timeline: [
      { month: "Jan", surveys: 50, foundations: 20, cabinet: 10, cable: 5, controlRoom: 0, ppic3: 0, overall: 14 },
      { month: "Feb", surveys: 75, foundations: 50, cabinet: 35, cable: 20, controlRoom: 10, ppic3: 5, overall: 33 },
      { month: "Mar", surveys: 90, foundations: 75, cabinet: 60, cable: 45, controlRoom: 30, ppic3: 15, overall: 53 },
      { month: "Apr", surveys: 100, foundations: 85, cabinet: 75, cable: 60, controlRoom: 45, ppic3: 30, overall: 66 },
      { month: "May", surveys: 100, foundations: 92, cabinet: 82, cable: 70, controlRoom: 55, ppic3: 40, overall: 73 },
      { month: "Jun", surveys: 100, foundations: 95, cabinet: 88, cable: 75, controlRoom: 60, ppic3: 45, overall: 77 },
    ]
  },
  sialkot: {
    surveys: 100,
    foundations: 92,
    cabinet: 85,
    cable: 70,
    controlRoom: 55,
    ppic3: 40,
    overall: 72,
    timeline: [
      { month: "Jan", surveys: 45, foundations: 15, cabinet: 8, cable: 3, controlRoom: 0, ppic3: 0, overall: 12 },
      { month: "Feb", surveys: 70, foundations: 45, cabinet: 30, cable: 18, controlRoom: 8, ppic3: 3, overall: 29 },
      { month: "Mar", surveys: 85, foundations: 70, cabinet: 55, cable: 40, controlRoom: 25, ppic3: 12, overall: 48 },
      { month: "Apr", surveys: 95, foundations: 82, cabinet: 70, cable: 55, controlRoom: 40, ppic3: 25, overall: 61 },
      { month: "May", surveys: 100, foundations: 88, cabinet: 78, cable: 65, controlRoom: 50, ppic3: 35, overall: 69 },
      { month: "Jun", surveys: 100, foundations: 92, cabinet: 85, cable: 70, controlRoom: 55, ppic3: 40, overall: 72 },
    ]
  },
  gujrat: {
    surveys: 100,
    foundations: 88,
    cabinet: 80,
    cable: 65,
    controlRoom: 50,
    ppic3: 35,
    overall: 68,
    timeline: [
      { month: "Jan", surveys: 40, foundations: 12, cabinet: 5, cable: 2, controlRoom: 0, ppic3: 0, overall: 10 },
      { month: "Feb", surveys: 65, foundations: 40, cabinet: 25, cable: 15, controlRoom: 5, ppic3: 2, overall: 26 },
      { month: "Mar", surveys: 80, foundations: 65, cabinet: 50, cable: 35, controlRoom: 20, ppic3: 10, overall: 43 },
      { month: "Apr", surveys: 90, foundations: 78, cabinet: 65, cable: 50, controlRoom: 35, ppic3: 20, overall: 56 },
      { month: "May", surveys: 100, foundations: 84, cabinet: 73, cable: 58, controlRoom: 45, ppic3: 28, overall: 65 },
      { month: "Jun", surveys: 100, foundations: 88, cabinet: 80, cable: 65, controlRoom: 50, ppic3: 35, overall: 68 },
    ]
  },
  jehlum: {
    surveys: 100,
    foundations: 85,
    cabinet: 75,
    cable: 60,
    controlRoom: 45,
    ppic3: 30,
    overall: 66,
    timeline: [
      { month: "Jan", surveys: 35, foundations: 10, cabinet: 3, cable: 1, controlRoom: 0, ppic3: 0, overall: 8 },
      { month: "Feb", surveys: 60, foundations: 35, cabinet: 20, cable: 12, controlRoom: 3, ppic3: 1, overall: 22 },
      { month: "Mar", surveys: 75, foundations: 60, cabinet: 45, cable: 30, controlRoom: 18, ppic3: 8, overall: 39 },
      { month: "Apr", surveys: 85, foundations: 72, cabinet: 60, cable: 45, controlRoom: 30, ppic3: 18, overall: 52 },
      { month: "May", surveys: 95, foundations: 80, cabinet: 68, cable: 55, controlRoom: 40, ppic3: 25, overall: 61 },
      { month: "Jun", surveys: 100, foundations: 85, cabinet: 75, cable: 60, controlRoom: 45, ppic3: 30, overall: 66 },
    ]
  },
  attock: {
    surveys: 100,
    foundations: 82,
    cabinet: 72,
    cable: 55,
    controlRoom: 40,
    ppic3: 25,
    overall: 62,
    timeline: [
      { month: "Jan", surveys: 30, foundations: 8, cabinet: 2, cable: 0, controlRoom: 0, ppic3: 0, overall: 7 },
      { month: "Feb", surveys: 55, foundations: 30, cabinet: 15, cable: 8, controlRoom: 2, ppic3: 0, overall: 18 },
      { month: "Mar", surveys: 70, foundations: 55, cabinet: 40, cable: 25, controlRoom: 15, ppic3: 5, overall: 35 },
      { month: "Apr", surveys: 80, foundations: 68, cabinet: 55, cable: 40, controlRoom: 28, ppic3: 15, overall: 48 },
      { month: "May", surveys: 90, foundations: 76, cabinet: 65, cable: 50, controlRoom: 35, ppic3: 20, overall: 56 },
      { month: "Jun", surveys: 100, foundations: 82, cabinet: 72, cable: 55, controlRoom: 40, ppic3: 25, overall: 62 },
    ]
  },
  hassanAbdal: {
    surveys: 100,
    foundations: 78,
    cabinet: 68,
    cable: 50,
    controlRoom: 35,
    ppic3: 20,
    overall: 59,
    timeline: [
      { month: "Jan", surveys: 25, foundations: 5, cabinet: 1, cable: 0, controlRoom: 0, ppic3: 0, overall: 5 },
      { month: "Feb", surveys: 50, foundations: 25, cabinet: 12, cable: 5, controlRoom: 1, ppic3: 0, overall: 15 },
      { month: "Mar", surveys: 65, foundations: 50, cabinet: 35, cable: 20, controlRoom: 12, ppic3: 3, overall: 29 },
      { month: "Apr", surveys: 75, foundations: 62, cabinet: 50, cable: 35, controlRoom: 25, ppic3: 10, overall: 43 },
      { month: "May", surveys: 85, foundations: 72, cabinet: 60, cable: 45, controlRoom: 30, ppic3: 15, overall: 51 },
      { month: "Jun", surveys: 100, foundations: 78, cabinet: 68, cable: 50, controlRoom: 35, ppic3: 20, overall: 59 },
    ]
  },
  sahiwal: {
    surveys: 100,
    foundations: 90,
    cabinet: 82,
    cable: 68,
    controlRoom: 52,
    ppic3: 38,
    overall: 72,
    timeline: [
      { month: "Jan", surveys: 48, foundations: 18, cabinet: 12, cable: 6, controlRoom: 2, ppic3: 0, overall: 16 },
      { month: "Feb", surveys: 72, foundations: 52, cabinet: 38, cable: 22, controlRoom: 12, ppic3: 5, overall: 33 },
      { month: "Mar", surveys: 88, foundations: 75, cabinet: 62, cable: 48, controlRoom: 32, ppic3: 18, overall: 55 },
      { month: "Apr", surveys: 95, foundations: 82, cabinet: 72, cable: 58, controlRoom: 42, ppic3: 28, overall: 63 },
      { month: "May", surveys: 100, foundations: 87, cabinet: 78, cable: 65, controlRoom: 48, ppic3: 34, overall: 69 },
      { month: "Jun", surveys: 100, foundations: 90, cabinet: 82, cable: 68, controlRoom: 52, ppic3: 38, overall: 72 },
    ]
  },
  okara: {
    surveys: 100,
    foundations: 87,
    cabinet: 78,
    cable: 62,
    controlRoom: 48,
    ppic3: 32,
    overall: 68,
    timeline: [
      { month: "Jan", surveys: 42, foundations: 15, cabinet: 8, cable: 4, controlRoom: 1, ppic3: 0, overall: 12 },
      { month: "Feb", surveys: 68, foundations: 48, cabinet: 32, cable: 18, controlRoom: 8, ppic3: 3, overall: 31 },
      { month: "Mar", surveys: 82, foundations: 68, cabinet: 55, cable: 42, controlRoom: 28, ppic3: 15, overall: 48 },
      { month: "Apr", surveys: 92, foundations: 78, cabinet: 68, cable: 55, controlRoom: 38, ppic3: 25, overall: 60 },
      { month: "May", surveys: 98, foundations: 84, cabinet: 74, cable: 60, controlRoom: 44, ppic3: 29, overall: 65 },
      { month: "Jun", surveys: 100, foundations: 87, cabinet: 78, cable: 62, controlRoom: 48, ppic3: 32, overall: 68 },
    ]
  },
  jhang: {
    surveys: 100,
    foundations: 83,
    cabinet: 70,
    cable: 58,
    controlRoom: 42,
    ppic3: 28,
    overall: 64,
    timeline: [
      { month: "Jan", surveys: 38, foundations: 12, cabinet: 6, cable: 3, controlRoom: 0, ppic3: 0, overall: 10 },
      { month: "Feb", surveys: 62, foundations: 42, cabinet: 28, cable: 15, controlRoom: 6, ppic3: 2, overall: 26 },
      { month: "Mar", surveys: 78, foundations: 62, cabinet: 48, cable: 35, controlRoom: 22, ppic3: 10, overall: 43 },
      { month: "Apr", surveys: 88, foundations: 72, cabinet: 60, cable: 48, controlRoom: 32, ppic3: 18, overall: 53 },
      { month: "May", surveys: 95, foundations: 78, cabinet: 65, cable: 55, controlRoom: 38, ppic3: 24, overall: 59 },
      { month: "Jun", surveys: 100, foundations: 83, cabinet: 70, cable: 58, controlRoom: 42, ppic3: 28, overall: 64 },
    ]
  },
  muzaffargarh: {
    surveys: 100,
    foundations: 80,
    cabinet: 65,
    cable: 52,
    controlRoom: 38,
    ppic3: 22,
    overall: 60,
    timeline: [
      { month: "Jan", surveys: 32, foundations: 8, cabinet: 3, cable: 1, controlRoom: 0, ppic3: 0, overall: 7 },
      { month: "Feb", surveys: 58, foundations: 38, cabinet: 22, cable: 12, controlRoom: 4, ppic3: 1, overall: 23 },
      { month: "Mar", surveys: 72, foundations: 58, cabinet: 42, cable: 28, controlRoom: 18, ppic3: 8, overall: 38 },
      { month: "Apr", surveys: 82, foundations: 68, cabinet: 55, cable: 42, controlRoom: 28, ppic3: 15, overall: 48 },
      { month: "May", surveys: 92, foundations: 75, cabinet: 60, cable: 48, controlRoom: 34, ppic3: 20, overall: 55 },
      { month: "Jun", surveys: 100, foundations: 80, cabinet: 65, cable: 52, controlRoom: 38, ppic3: 22, overall: 60 },
    ]
  },
};

export const CITY_NAMES: Record<string, string> = {
  sheikhupura: "Sheikhupura",
  sialkot: "Sialkot",
  gujrat: "Gujrat",
  jehlum: "Jehlum",
  attock: "Attock",
  hassanAbdal: "Hassan Abdal",
  sahiwal: "Sahiwal",
  okara: "Okara",
  jhang: "Jhang",
  muzaffargarh: "Muzaffargarh",
};

