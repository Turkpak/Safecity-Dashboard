// Bahawalpur Division Projects Data
// This data is parsed from the Excel file: Safe City.xlsx
// Contains real project, subproject, and milestone data for Bahawalpur Division

import bahawalpurData from './bahawalpurProjectsData.json';
import { SubProject } from '@/components/dashboard/SubProjectCard';

export interface Milestone {
  id: string;
  name: string;
  duration: number;
  startDate: string | null;
  finishDate: string | null;
}

export interface BahawalpurSubProject {
  id: string;
  name: string;
  duration: number;
  startDate: string | null;
  finishDate: string | null;
  milestones: Milestone[];
}

export interface BahawalpurProject {
  id: string;
  name: string;
  duration: number;
  startDate: string | null;
  finishDate: string | null;
  subProjects: BahawalpurSubProject[];
}

export interface BahawalpurTehsilData {
  projects: BahawalpurProject[];
}

export interface BahawalpurDistrictData {
  tehsils: Record<string, BahawalpurTehsilData>;
}

export interface BahawalpurProjectsData {
  division: string;
  districts: Record<string, BahawalpurDistrictData>;
}

export const BHAWALPUR_PROJECTS_DATA: BahawalpurProjectsData = bahawalpurData as BahawalpurProjectsData;

// Helper function to get projects for a specific tehsil
export function getBahawalpurTehsilProjects(
  district: string,
  tehsil: string
): BahawalpurProject[] {
  const districtData = BHAWALPUR_PROJECTS_DATA.districts[district];
  if (!districtData) return [];
  
  const tehsilData = districtData.tehsils[tehsil];
  if (!tehsilData) return [];
  
  return tehsilData.projects;
}

// Convert Bahawalpur sub-projects to SubProject format for the dashboard
export function convertToSubProjects(
  bahawalpurSubProjects: BahawalpurSubProject[],
  phaseKey: string
): SubProject[] {
  if (!bahawalpurSubProjects || bahawalpurSubProjects.length === 0) {
    return [];
  }

  // Calculate total duration for weight calculation
  const totalDuration = bahawalpurSubProjects.reduce((sum, sp) => sum + (sp.duration || 1), 0);
  const now = new Date();

  return bahawalpurSubProjects.map((sp, index) => {
    // Calculate progress based on milestones completion and deadlines
    const milestoneCount = sp.milestones.length;
    
    // Calculate actual progress based on completed milestones (using dates)
    let completedMilestones = 0;
    if (milestoneCount > 0 && sp.milestones.length > 0) {
      sp.milestones.forEach(milestone => {
        if (milestone.finishDate) {
          const finishDate = new Date(milestone.finishDate);
          // If finish date has passed, consider it completed
          if (finishDate <= now) {
            completedMilestones++;
          } else if (milestone.startDate) {
            const startDate = new Date(milestone.startDate);
            // If started but not finished, calculate partial completion
            if (startDate <= now && now < finishDate) {
              const totalDays = (finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              if (totalDays > 0) {
                completedMilestones += Math.min(1, elapsedDays / totalDays);
              }
            }
          }
        }
      });
    }
    
    const actualProgress = milestoneCount > 0 
      ? (completedMilestones / milestoneCount) * 100 
      : 0;
    
    // Calculate planned progress based on project timeline
    let plannedProgress = 75; // Default
    if (sp.startDate && sp.finishDate) {
      const startDate = new Date(sp.startDate);
      const finishDate = new Date(sp.finishDate);
      const totalDays = (finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (totalDays > 0) {
        plannedProgress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
      }
    }
    
    // Calculate weight based on duration
    const weight = totalDuration > 0 ? (sp.duration || 1) / totalDuration : 1 / bahawalpurSubProjects.length;

    return {
      id: `${phaseKey}-${sp.id}`,
      name: sp.name, // Real name from Excel
      actualProgress: Math.min(100, Math.max(0, actualProgress)),
      plannedProgress: Math.min(100, Math.max(0, plannedProgress)),
      weight: weight,
      startDate: sp.startDate, // Real deadline from Excel
      finishDate: sp.finishDate, // Real deadline from Excel
      milestones: sp.milestones.map(m => ({
        id: m.id, // Real Activity ID from Excel (e.g., A1020, A1030)
        name: m.name, // Real Activity Name from Excel
        duration: m.duration,
        startDate: m.startDate,
        finishDate: m.finishDate
      }))
    };
  });
}

// Calculate project progress based on sub-projects and milestones
export function calculateProjectProgress(project: BahawalpurProject): {
  actual: number;
  planned: number;
  overall: number;
} {
  if (!project.subProjects || project.subProjects.length === 0) {
    return { actual: 0, planned: 0, overall: 0 };
  }

  const now = new Date();
  let totalActual = 0;
  let totalPlanned = 0;
  let totalWeight = 0;

  project.subProjects.forEach(subProject => {
    const milestoneCount = subProject.milestones.length;
    let completedMilestones = 0;
    
    if (milestoneCount > 0) {
      subProject.milestones.forEach(milestone => {
        if (milestone.finishDate) {
          const finishDate = new Date(milestone.finishDate);
          if (finishDate <= now) {
            completedMilestones++;
          } else if (milestone.startDate) {
            const startDate = new Date(milestone.startDate);
            if (startDate <= now && now < finishDate) {
              const totalDays = (finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
              if (totalDays > 0) {
                completedMilestones += Math.min(1, elapsedDays / totalDays);
              }
            }
          }
        }
      });
    }
    
    const subProjectActual = milestoneCount > 0 ? (completedMilestones / milestoneCount) * 100 : 0;
    
    let subProjectPlanned = 75;
    if (subProject.startDate && subProject.finishDate) {
      const startDate = new Date(subProject.startDate);
      const finishDate = new Date(subProject.finishDate);
      const totalDays = (finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (totalDays > 0) {
        subProjectPlanned = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
      }
    }
    
    const weight = subProject.duration || 1;
    totalActual += subProjectActual * weight;
    totalPlanned += subProjectPlanned * weight;
    totalWeight += weight;
  });

  const actual = totalWeight > 0 ? totalActual / totalWeight : 0;
  const planned = totalWeight > 0 ? totalPlanned / totalWeight : 0;
  const overall = (actual + planned) / 2;

  return {
    actual: Math.min(100, Math.max(0, actual)),
    planned: Math.min(100, Math.max(0, planned)),
    overall: Math.min(100, Math.max(0, overall))
  };
}

// Get all sub-projects for a tehsil, grouped by project phase
export function getTehsilSubProjectsByPhase(
  district: string,
  tehsil: string
): Record<string, SubProject[]> {
  const projects = getBahawalpurTehsilProjects(district, tehsil);
  const result: Record<string, SubProject[]> = {};

  // Map projects to installation phases
  // Based on project names, map them to: surveys, foundations, cabinet, cable, controlRoom, ppic3
  projects.forEach(project => {
    const projectName = project.name.toLowerCase();
    let phaseKey = 'surveys'; // default

    if (projectName.includes('camera') || projectName.includes('surveillance') || projectName.includes('field')) {
      phaseKey = 'surveys';
    } else if (projectName.includes('foundation') || projectName.includes('pole') || projectName.includes('excavation')) {
      phaseKey = 'foundations';
    } else if (projectName.includes('cabinet') || projectName.includes('power')) {
      phaseKey = 'cabinet';
    } else if (projectName.includes('ofc') || projectName.includes('cable') || projectName.includes('network') || projectName.includes('connectivity')) {
      phaseKey = 'cable';
    } else if (projectName.includes('control room') || projectName.includes('display') || projectName.includes('furniture')) {
      phaseKey = 'controlRoom';
    } else if (projectName.includes('server') || projectName.includes('software') || projectName.includes('system') || projectName.includes('vms') || projectName.includes('ai')) {
      phaseKey = 'ppic3';
    }

    if (!result[phaseKey]) {
      result[phaseKey] = [];
    }

    const subProjects = convertToSubProjects(project.subProjects, phaseKey);
    result[phaseKey].push(...subProjects);
  });

  return result;
}

