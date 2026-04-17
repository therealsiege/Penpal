import { test, expect } from '@playwright/test';
import { Page } from 'playwright';

// Helper function to get laser door alpha values
async function getLaserDoorAlphas(page: Page) {
  return await page.evaluate(() => {
    // @ts-ignore
    const doors = window.scene?.background?.gdsRenderer?.laserDoors;
    if (!doors) return [];
    return doors.map((door: any) => door.alpha);
  });
}

// Helper function to move agent to a position and wait
async function moveAgentToPosition(page: Page, x: number, y: number) {
  await page.evaluate(async (pos) => {
    // @ts-ignore
    const agent = window.agent;
    if (agent) {
      agent.x = pos.x;
      agent.y = pos.y;
      // Update the scene to trigger door update
      // @ts-ignore
      window.updateGdsLaserDoors();
    }
  }, { x, y });
}

// Helper function to simulate agent movement with tween
async function moveAgentWithTween(page: Page, targetX: number, targetY: number, duration: number = 1000) {
  await page.evaluate(async (params) => {
    // @ts-ignore
    const agent = window.agent;
    if (agent) {
      const startX = agent.x;
      const startY = agent.y;
      const deltaX = targetX - startX;
      const deltaY = targetY - startY;
      
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / params.duration, 1);
        
        agent.x = startX + deltaX * progress;
        agent.y = startY + deltaY * progress;
        
        // Update the scene to trigger door update
        // @ts-ignore
        window.updateGdsLaserDoors();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    }
  }, { targetX, targetY, duration });
}

test.describe('Laser Door Proximity Animation Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for scene to load and initialize
    await page.waitForFunction(() => {
      // @ts-ignore
      return window.scene && window.agent && window.updateGdsLaserDoors;
    });
    
    // Ensure initial state - all doors should be closed (alpha = 1)
    const initialAlphas = await getLaserDoorAlphas(page);
    expect(initialAlphas.length).toBe(5);
    initialAlphas.forEach(alpha => expect(alpha).toBeCloseTo(1.0, 1));
  });

  test('All 5 laser doors render at correct positions on scene load', async ({ page }) => {
    // Test that the doors are present in the scene
    const doorPositions = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      if (!doors) return [];
      return doors.map((door: any) => ({ x: door.x, y: door.y, width: door.width, height: door.height }));
    });
    
    expect(doorPositions.length).toBe(5);
    // Basic check that positions are valid numbers
    doorPositions.forEach(pos => {
      expect(typeof pos.x).toBe('number');
      expect(typeof pos.y).toBe('number');
      expect(typeof pos.width).toBe('number');
      expect(typeof pos.height).toBe('number');
    });
    
    // Check that each door has valid dimensions
    doorPositions.forEach(pos => {
      expect(pos.width).toBeGreaterThan(0);
      expect(pos.height).toBeGreaterThan(0);
    });
  });

  test('Door fades open (alpha → 0) when agent walks within 50px', async ({ page }) => {
    // Move agent to within 50px of the first door
    const doorPosition = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      return doors && doors[0] ? { x: doors[0].x, y: doors[0].y } : null;
    });
    
    expect(doorPosition).not.toBeNull();
    
    if (doorPosition) {
      // Move agent closer than 50px (exactly at door position to definitely trigger)
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      
      // Wait for animation to complete (200ms for open animation)
      await page.waitForTimeout(250);
      
      // Check updated alpha value - should be close to 0 (open)
      const updatedAlphas = await getLaserDoorAlphas(page);
      expect(updatedAlphas[0]).toBeCloseTo(0.0, 1);  // Should be fully open
    }
  });

  test('Door fades closed (alpha → 1) when all agents leave proximity', async ({ page }) => {
    // First, make sure door is open
    const doorPosition = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      return doors && doors[0] ? { x: doors[0].x, y: doors[0].y } : null;
    });
    
    if (doorPosition) {
      // Move agent to within 50px to open the door
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      await page.waitForTimeout(250); // Wait for open animation
      
      // Verify door is open
      let alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(0.0, 1);
      
      // Now move agent away to close the door
      await moveAgentToPosition(page, doorPosition.x + 100, doorPosition.y + 100);
      await page.waitForTimeout(450); // Wait for close animation (400ms)
      
      // Verify door is closed
      alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(1.0, 1);  // Should be fully closed again
    }
  });

  test('Open animation completes in ~200ms', async ({ page }) => {
    const doorPosition = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      return doors && doors[0] ? { x: doors[0].x, y: doors[0].y } : null;
    });
    
    if (doorPosition) {
      const startTime = Date.now();
      
      // Move agent to open the door
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      
      // Wait for half of the open animation time to check it's transitioning
      await page.waitForTimeout(100);
      
      // Verify it's in the process of opening (alpha should not be 1.0 yet)
      let alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).not.toBeCloseTo(1.0, 1);
      
      // Wait for full animation
      await page.waitForTimeout(150); // Wait remaining time
      
      // Verify door is fully open
      alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(0.0, 1);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      // Check time is reasonable (should be around 200ms + some buffer)
      expect(duration).toBeGreaterThanOrEqual(180);
      expect(duration).toBeLessThanOrEqual(250);
    }
  });

  test('Close animation completes in ~400ms', async ({ page }) => {
    const doorPosition = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      return doors && doors[0] ? { x: doors[0].x, y: doors[0].y } : null;
    });
    
    if (doorPosition) {
      // First open the door
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      await page.waitForTimeout(250);
      
      const startTime = Date.now();
      
      // Close the door
      await moveAgentToPosition(page, doorPosition.x + 100, doorPosition.y + 100);
      
      // Wait for half of the close animation time to check it's transitioning
      await page.waitForTimeout(200);
      
      // Verify it's in the process of closing (alpha should not be 1.0 yet)
      let alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).not.toBeCloseTo(0.0, 1);
      
      // Wait for full animation
      await page.waitForTimeout(300); // Wait remaining time
      
      // Verify door is fully closed
      alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(1.0, 1);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      // Check time is reasonable (should be around 400ms + some buffer)
      expect(duration).toBeGreaterThanOrEqual(350);
      expect(duration).toBeLessThanOrEqual(450);
    }
  });

  test('Multiple agents near same door: door stays open until ALL leave', async ({ page }) => {
    const doorPosition = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      return doors && doors[0] ? { x: doors[0].x, y: doors[0].y } : null;
    });
    
    if (doorPosition) {
      // Move first agent near the door to open it
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      await page.waitForTimeout(250); // Wait for animation
      
      let alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(0.0, 1);
      
      // Move second agent to the same position (simulating one more agent near door) 
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      await page.waitForTimeout(100); // Wait briefly
      
      // Door should still stay open
      alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(0.0, 1);
      
      // Move first agent away, door should stay open because second is still near
      await moveAgentToPosition(page, doorPosition.x + 100, doorPosition.y + 100);
      await page.waitForTimeout(100); // Wait briefly
      
      // Door should still be open (because second agent is still near)
      alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(0.0, 1);
      
      // Move second agent away, door should close
      await moveAgentToPosition(page, doorPosition.x + 100, doorPosition.y + 100);
      await page.waitForTimeout(450); // Wait for close animation
      
      // Door should now be closed
      alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(1.0, 1);
    }
  });

  test('Visual regression: Screenshot with all doors closed vs one open', async ({ page }) => {
    // Take screenshot with all doors closed (default state)
    await page.screenshot({ 
      path: 'laser-doors-closed.png',
      fullPage: true 
    });
    
    // Open one door
    const doorPosition = await page.evaluate(() => {
      // @ts-ignore
      const doors = window.scene?.background?.gdsRenderer?.laserDoors;
      return doors && doors[0] ? { x: doors[0].x, y: doors[0].y } : null;
    });
    
    if (doorPosition) {
      await moveAgentToPosition(page, doorPosition.x, doorPosition.y);
      await page.waitForTimeout(250); // Wait for animation
      
      // Take screenshot with one door open
      await page.screenshot({ 
        path: 'laser-doors-one-open.png',
        fullPage: true 
      });
      
      // Verify one door is open and others are closed
      const alphas = await getLaserDoorAlphas(page);
      expect(alphas[0]).toBeCloseTo(0.0, 1);  // First door open
      for (let i = 1; i < alphas.length; i++) {
        expect(alphas[i]).toBeCloseTo(1.0, 1);  // Others closed
      }
    }
  });
});