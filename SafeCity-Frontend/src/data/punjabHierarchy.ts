// Punjab Province Administrative Hierarchy
// Division -> District -> Tehsil -> Cities

export interface PunjabHierarchy {
  division: string;
  districts: {
    district: string;
    tehsils: {
      tehsil: string;
      cities: string[];
    }[];
  }[];
}

export const PUNJAB_HIERARCHY: PunjabHierarchy[] = [
  {
    division: "Lahore",
    districts: [
      {
        district: "Lahore",
        tehsils: [
          { tehsil: "Lahore City", cities: ["Lahore"] },
          { tehsil: "Lahore Cantt", cities: ["Lahore"] },
          { tehsil: "Model Town", cities: [] },
          { tehsil: "Shalimar", cities: [] },
          { tehsil: "Raiwind", cities: [] },
          { tehsil: "Allama Iqbal", cities: [] },
          { tehsil: "Nishtar", cities: [] },
          { tehsil: "Saddar", cities: [] },
          { tehsil: "Wagha", cities: [] },
          { tehsil: "Ravi", cities: [] },
        ]
      },
      {
        district: "Sheikhupura",
        tehsils: [
          { tehsil: "Sheikhupura", cities: ["Sheikhupura"] },
          { tehsil: "Ferozewala", cities: [] },
          { tehsil: "Muridke", cities: [] },
          { tehsil: "Sharaqpur", cities: [] },
          { tehsil: "Safdarabad", cities: [] },
        ]
      },
      {
        district: "Nankana Sahib",
        tehsils: [
          { tehsil: "Nankana Sahib", cities: [] },
          { tehsil: "Shahkot", cities: [] },
          { tehsil: "Sangla Hill", cities: [] },
        ]
      },
      {
        district: "Kasur",
        tehsils: [
          { tehsil: "Kasur", cities: [] },
          { tehsil: "Kot Radha Kishan", cities: [] },
          { tehsil: "Chunian", cities: [] },
          { tehsil: "Pattoki", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Rawalpindi",
    districts: [
      {
        district: "Rawalpindi",
        tehsils: [
          { tehsil: "Rawalpindi", cities: ["Rawalpindi"] },
          { tehsil: "Gujar Khan", cities: [] },
          { tehsil: "Kahuta", cities: [] },
          { tehsil: "Kallar Syedan", cities: [] },
          { tehsil: "Taxila", cities: ["Taxila"] },
        ]
      },
      {
        district: "Jhelum",
        tehsils: [
          { tehsil: "Jhelum", cities: ["Jehlum"] },
          { tehsil: "Dina", cities: [] },
          { tehsil: "Pind Dadan Khan", cities: [] },
          { tehsil: "Sohawa", cities: [] },
        ]
      },
      {
        district: "Attock",
        tehsils: [
          { tehsil: "Attock", cities: ["Attock"] },
          { tehsil: "Fateh Jang", cities: [] },
          { tehsil: "Hassan Abdal", cities: ["Hassan Abdal"] },
          { tehsil: "Hazro", cities: [] },
          { tehsil: "Jand", cities: [] },
          { tehsil: "Pindi Gheb", cities: [] },
        ]
      },
      {
        district: "Murree",
        tehsils: [
          { tehsil: "Murree", cities: ["Murree"] },
          { tehsil: "Kotli Sattian", cities: [] },
        ]
      },
      {
        district: "Talagang",
        tehsils: [
          { tehsil: "Talagang", cities: [] },
          { tehsil: "Lawa", cities: [] },
        ]
      },
      {
        district: "Chakwal",
        tehsils: [
          { tehsil: "Chakwal", cities: [] },
          { tehsil: "Choa Saidan Shah", cities: [] },
          { tehsil: "Kallar Kahar", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Gujranwala",
    districts: [
      {
        district: "Gujranwala",
        tehsils: [
          { tehsil: "Gujranwala City", cities: [] },
          { tehsil: "Gujranwala Saddar", cities: [] },
          { tehsil: "Kamoke", cities: [] },
          { tehsil: "Nowshera", cities: [] },
        ]
      },
      {
        district: "Sialkot",
        tehsils: [
          { tehsil: "Sialkot", cities: ["Sialkot"] },
          { tehsil: "Daska", cities: [] },
          { tehsil: "Pasrur", cities: [] },
          { tehsil: "Sambrial", cities: [] },
        ]
      },
      {
        district: "Narowal",
        tehsils: [
          { tehsil: "Narowal", cities: [] },
          { tehsil: "Shakargarh", cities: [] },
          { tehsil: "Zafarwal", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Gujrat",
    districts: [
      {
        district: "Gujrat",
        tehsils: [
          { tehsil: "Gujrat", cities: ["Gujrat"] },
          { tehsil: "Kharian", cities: [] },
          { tehsil: "Sarai Alamgir", cities: [] },
          { tehsil: "Jalalpur Jattan", cities: [] },
          { tehsil: "Kunja", cities: [] },
        ]
      },
      {
        district: "Hafizabad",
        tehsils: [
          { tehsil: "Hafizabad", cities: [] },
          { tehsil: "Pindi Bhattian", cities: [] },
        ]
      },
      {
        district: "Mandi Bahauddin",
        tehsils: [
          { tehsil: "Mandi Bahauddin", cities: [] },
          { tehsil: "Malakwal", cities: [] },
          { tehsil: "Phalia", cities: [] },
        ]
      },
      {
        district: "Wazirabad",
        tehsils: [
          { tehsil: "Wazirabad", cities: [] },
          { tehsil: "Ali Pur Chatta", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Sargodha",
    districts: [
      {
        district: "Sargodha",
        tehsils: [
          { tehsil: "Sargodha", cities: ["Sargodha"] },
          { tehsil: "Sahiwal Tehsil (in Sargodha District)", cities: [] },
          { tehsil: "Bhalwal", cities: [] },
          { tehsil: "Bhera", cities: [] },
          { tehsil: "Kot Momin", cities: [] },
          { tehsil: "Shahpur", cities: [] },
          { tehsil: "Sillanwala", cities: [] },
        ]
      },
      {
        district: "Khushab",
        tehsils: [
          { tehsil: "Khushab", cities: [] },
          { tehsil: "Noorpur Thal", cities: [] },
          { tehsil: "Quaidabad", cities: [] },
          { tehsil: "Naushera (Wadi-e-Soon)", cities: [] },
        ]
      },
      {
        district: "Mianwali",
        tehsils: [
          { tehsil: "Mianwali", cities: ["Mian Wali"] },
          { tehsil: "Isakhel", cities: [] },
          { tehsil: "Piplan", cities: [] },
        ]
      },
      {
        district: "Bhakkar",
        tehsils: [
          { tehsil: "Bhakkar", cities: [] },
          { tehsil: "Darya Khan", cities: [] },
          { tehsil: "Kaloorkot", cities: [] },
          { tehsil: "Mankera", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Faisalabad",
    districts: [
      {
        district: "Faisalabad",
        tehsils: [
          { tehsil: "Faisalabad", cities: ["Faisalabad"] },
          { tehsil: "Faisalabad Saddar", cities: [] },
          { tehsil: "Chak Jhumra", cities: [] },
          { tehsil: "Jaranwala", cities: [] },
          { tehsil: "Samundri", cities: [] },
          { tehsil: "Tandlianwala", cities: [] },
        ]
      },
      {
        district: "Jhang",
        tehsils: [
          { tehsil: "Jhang", cities: ["Jhang"] },
          { tehsil: "Shorkot", cities: [] },
          { tehsil: "Ahmadpur Sial", cities: [] },
          { tehsil: "Athara Hazari", cities: [] },
          { tehsil: "Mandi Shah Jeewna", cities: [] },
        ]
      },
      {
        district: "Chiniot",
        tehsils: [
          { tehsil: "Chiniot", cities: [] },
          { tehsil: "Bhawana", cities: [] },
          { tehsil: "Lalian", cities: [] },
        ]
      },
      {
        district: "Toba Tek Singh",
        tehsils: [
          { tehsil: "Toba Tek Singh", cities: [] },
          { tehsil: "Gojra", cities: [] },
          { tehsil: "Kamalia", cities: [] },
          { tehsil: "Pir Mahal", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Multan",
    districts: [
      {
        district: "Multan",
        tehsils: [
          { tehsil: "Multan City", cities: ["Multan"] },
          { tehsil: "Multan Saddar", cities: [] },
          { tehsil: "Jalalpur Pirwala", cities: [] },
          { tehsil: "Shujabad", cities: [] },
        ]
      },
      {
        district: "Vehari",
        tehsils: [
          { tehsil: "Vehari", cities: [] },
          { tehsil: "Burewala", cities: [] },
          { tehsil: "Mailsi", cities: [] },
        ]
      },
      {
        district: "Lodhran",
        tehsils: [
          { tehsil: "Lodhran", cities: [] },
          { tehsil: "Kahror Pacca", cities: [] },
          { tehsil: "Dunyapur", cities: [] },
        ]
      },
      {
        district: "Khanewal",
        tehsils: [
          { tehsil: "Khanewal", cities: [] },
          { tehsil: "Jahanian", cities: [] },
          { tehsil: "Kabirwala", cities: [] },
          { tehsil: "Mian Channu", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Bahawalpur",
    districts: [
      {
        district: "Bahawalpur",
        tehsils: [
          { tehsil: "Bahawalpur City", cities: ["Bahawalpur"] },
          { tehsil: "Bahawalpur Saddar", cities: [] },
          { tehsil: "Ahmedpur East", cities: [] },
          { tehsil: "Hasilpur", cities: [] },
          { tehsil: "Khairpur Tamewali", cities: [] },
          { tehsil: "Yazman", cities: [] },
        ]
      },
      {
        district: "Bahawalnagar",
        tehsils: [
          { tehsil: "Bahawalnagar", cities: [] },
          { tehsil: "Chishtian", cities: [] },
          { tehsil: "Fort Abbas", cities: [] },
          { tehsil: "Haroonabad", cities: [] },
          { tehsil: "Minchinabad", cities: [] },
        ]
      },
      {
        district: "Rahim Yar Khan",
        tehsils: [
          { tehsil: "Rahim Yar Khan", cities: ["RYK"] },
          { tehsil: "Khanpur", cities: [] },
          { tehsil: "Liaqatpur", cities: [] },
          { tehsil: "Sadiqabad", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Dera Ghazi Khan",
    districts: [
      {
        district: "Dera Ghazi Khan",
        tehsils: [
          { tehsil: "Dera Ghazi Khan", cities: ["DG Khan"] },
          { tehsil: "De-excluded Area DG Khan", cities: [] },
          { tehsil: "Kot Chutta", cities: [] },
        ]
      },
      {
        district: "Taunsa",
        tehsils: [
          { tehsil: "Taunsa", cities: [] },
          { tehsil: "Kohe Suleiman", cities: [] },
          { tehsil: "Vevoha", cities: [] },
        ]
      },
      {
        district: "Rajanpur",
        tehsils: [
          { tehsil: "Rajanpur", cities: [] },
          { tehsil: "Jampur", cities: [] },
          { tehsil: "Rojhan", cities: [] },
        ]
      },
      {
        district: "Layyah",
        tehsils: [
          { tehsil: "Layyah", cities: [] },
          { tehsil: "Karor Lal Esan", cities: [] },
          { tehsil: "Chaubara", cities: [] },
        ]
      },
      {
        district: "Kot Addu",
        tehsils: [
          { tehsil: "Kot Addu", cities: [] },
          { tehsil: "Chowk Sarwar Shaheed", cities: [] },
        ]
      },
      {
        district: "Muzaffargarh",
        tehsils: [
          { tehsil: "Muzaffargarh", cities: ["Muzaffargarh"] },
          { tehsil: "Alipur", cities: [] },
          { tehsil: "Jatoi", cities: [] },
        ]
      }
    ]
  },
  {
    division: "Sahiwal",
    districts: [
      {
        district: "Sahiwal",
        tehsils: [
          { tehsil: "Sahiwal", cities: ["Sahiwal"] },
          { tehsil: "Chichawatni", cities: [] },
          { tehsil: "Harappa", cities: [] },
        ]
      },
      {
        district: "Okara",
        tehsils: [
          { tehsil: "Okara", cities: ["Okara"] },
          { tehsil: "Renala Khurd", cities: [] },
          { tehsil: "Depalpur", cities: [] },
          { tehsil: "Hujra Shah Muqeem", cities: [] },
        ]
      },
      {
        district: "Pakpattan",
        tehsils: [
          { tehsil: "Pakpattan", cities: [] },
          { tehsil: "Arifwala", cities: [] },
          { tehsil: "Burewala", cities: [] },
        ]
      }
    ]
  }
];

// Helper function to get all divisions
export const getAllDivisions = (): string[] => {
  return PUNJAB_HIERARCHY.map(d => d.division);
};

// Helper function to get districts by division
export const getDistrictsByDivision = (division: string): string[] => {
  const div = PUNJAB_HIERARCHY.find(d => d.division === division);
  return div ? div.districts.map(dist => dist.district) : [];
};

// Helper function to get tehsils by division and district
export const getTehsilsByDivisionAndDistrict = (division: string, district: string): string[] => {
  const div = PUNJAB_HIERARCHY.find(d => d.division === division);
  if (!div) return [];
  const dist = div.districts.find(d => d.district === district);
  return dist ? dist.tehsils.map(t => t.tehsil) : [];
};

// Helper function to get cities by division, district, and tehsil
export const getCitiesByHierarchy = (division: string, district: string, tehsil: string): string[] => {
  const div = PUNJAB_HIERARCHY.find(d => d.division === division);
  if (!div) return [];
  const dist = div.districts.find(d => d.district === district);
  if (!dist) return [];
  const teh = dist.tehsils.find(t => t.tehsil === tehsil);
  return teh ? teh.cities : [];
};

// Map our city names to hierarchy cities
export const CITY_TO_HIERARCHY_MAP: Record<string, { division: string; district: string; tehsil: string }> = {
  "Sheikhupura": { division: "Lahore", district: "Sheikhupura", tehsil: "Sheikhupura" },
  "Sialkot": { division: "Gujranwala", district: "Sialkot", tehsil: "Sialkot" },
  "Gujrat": { division: "Gujrat", district: "Gujrat", tehsil: "Gujrat" },
  "Jehlum": { division: "Rawalpindi", district: "Jhelum", tehsil: "Jhelum" },
  "Attock": { division: "Rawalpindi", district: "Attock", tehsil: "Attock" },
  "Hassan Abdal": { division: "Rawalpindi", district: "Attock", tehsil: "Hassan Abdal" },
  "Sahiwal": { division: "Sahiwal", district: "Sahiwal", tehsil: "Sahiwal" },
  "Okara": { division: "Sahiwal", district: "Okara", tehsil: "Okara" },
  "Jhang": { division: "Faisalabad", district: "Jhang", tehsil: "Jhang" },
  "Muzaffargarh": { division: "Dera Ghazi Khan", district: "Muzaffargarh", tehsil: "Muzaffargarh" },
  "Taxila": { division: "Rawalpindi", district: "Rawalpindi", tehsil: "Taxila" },
  "Murree": { division: "Rawalpindi", district: "Murree", tehsil: "Murree" },
  "Sargodha": { division: "Sargodha", district: "Sargodha", tehsil: "Sargodha" },
  "Mian Wali": { division: "Sargodha", district: "Mianwali", tehsil: "Mianwali" },
  "Faisalabad": { division: "Faisalabad", district: "Faisalabad", tehsil: "Faisalabad" },
  "Multan": { division: "Multan", district: "Multan", tehsil: "Multan City" },
  "Bahawalpur": { division: "Bahawalpur", district: "Bahawalpur", tehsil: "Bahawalpur City" },
  "RYK": { division: "Bahawalpur", district: "Rahim Yar Khan", tehsil: "Rahim Yar Khan" },
  "DG Khan": { division: "Dera Ghazi Khan", district: "Dera Ghazi Khan", tehsil: "Dera Ghazi Khan" },
  "Lahore": { division: "Lahore", district: "Lahore", tehsil: "Lahore City" },
  "Rawalpindi": { division: "Rawalpindi", district: "Rawalpindi", tehsil: "Rawalpindi" },
};
