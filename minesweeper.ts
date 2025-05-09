import * as path from '@std/path';

export interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  adjacentMines: number;
}

export type GameState = 'playing' | 'won' | 'lost';

export type ImageKey =
  | 'cell_hidden' // gray-button.svg
  | 'cell_revealed_0' // gray.svg
  | 'cell_revealed_1' // 1.svg
  | 'cell_revealed_2' // 2.svg
  | 'cell_revealed_3' // 3.svg
  | 'cell_revealed_4' // 4.svg
  | 'cell_revealed_5' // 5.svg
  | 'cell_revealed_6' // 6.svg
  | 'cell_revealed_7' // 7.svg
  | 'cell_revealed_8' // 8.svg
  | 'mine_normal' // mine.svg (for unrevealed mines at game end, or revealed mines in won state)
  | 'mine_hit' // mine-red.svg (for the mine that was clicked and caused loss)
  | 'status_playing' // emoji-smile.svg
  | 'status_won' // emoji-sunglasses.svg
  | 'status_lost'; // emoji-dead.svg

export class Minesweeper {
  // deno-fmt-ignore
  // Static readonly array for neighbor directions
  private static readonly DIRECTIONS: ReadonlyArray<[number, number]> = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1], [1, 0], [1, 1],
  ];

  private board: Cell[][];
  private gameState: GameState;
  private mineCount: number;
  private rows: number;
  private cols: number;
  private remainingNonMineCells: number; // Number of non-mine cells that need to be revealed to win
  private hitMineCoordinates: { row: number; col: number } | null = null; // To identify the exploded mine

  private startTime: Date; // Time when the game was started
  private endTime: Date | null = null; // Time when the game ended (won or lost)

  // Store loaded images
  private imageCache: Map<ImageKey, Uint8Array>;
  private imageDirectory: string;

  constructor(rows: number, cols: number, mineCount: number, imageDirectory: string = './image') {
    // Validate input parameters
    if (rows <= 0 || cols <= 0) throw new Error('Board dimensions (rows, cols) must be positive integers.');
    if (mineCount < 0) throw new Error('Mine count cannot be negative.');
    // If mineCount > rows * cols, the placeMines method would loop indefinitely
    // as it tries to place more mines than available cells.
    if (mineCount > rows * cols) throw new Error('Mine count cannot exceed the total number of cells (rows * cols).');

    this.rows = rows;
    this.cols = cols;
    this.mineCount = mineCount;

    this.gameState = 'playing';
    // This tracks the number of non-mine cells that still need to be revealed for the player to win.
    this.remainingNonMineCells = rows * cols - mineCount;
    this.board = this.initializeBoard();
    this.placeMines();
    this.calculateAdjacentMines();
    this.startTime = new Date(); // Record the start time of the game

    this.imageDirectory = imageDirectory;
    this.imageCache = new Map();
    this.loadImages(); // Load images upon initialization
  }

  /**
   * Defines the mapping from logical image keys to their filenames.
   */
  private getImageFileMap(): Record<ImageKey, string> {
    return {
      cell_hidden: 'gray-button.svg',
      cell_revealed_0: 'gray.svg',
      cell_revealed_1: '1.svg',
      cell_revealed_2: '2.svg',
      cell_revealed_3: '3.svg',
      cell_revealed_4: '4.svg',
      cell_revealed_5: '5.svg',
      cell_revealed_6: '6.svg',
      cell_revealed_7: '7.svg',
      cell_revealed_8: '8.svg',
      mine_normal: 'mine.svg',
      mine_hit: 'mine-red.svg',
      status_playing: 'emoji-surprise-smile.svg',
      status_won: 'emoji-sunglasses.svg',
      status_lost: 'emoji-dead.svg',
    };
  }

  /**
   * Loads all necessary images from the specified directory into the imageCache.
   * This method assumes a Node.js environment for file system access.
   */
  private loadImages(): void {
    const imageFileMap = this.getImageFileMap();
    for (const key in imageFileMap) {
      if (Object.prototype.hasOwnProperty.call(imageFileMap, key)) {
        const typedKey = key as ImageKey;
        const fileName = imageFileMap[typedKey];
        const filePath = path.join(this.imageDirectory, fileName); // Use path.join for cross-platform compatibility
        try {
          const fileBuffer = Deno.readFileSync(filePath);
          this.imageCache.set(typedKey, new Uint8Array(fileBuffer)); // Deno.readFileSync returns a Buffer, which is a Uint8Array
          // console.log(`Loaded image: ${filePath} for key: ${typedKey}`);
        } catch (error) {
          console.error(`Failed to load image ${filePath} for key ${typedKey}:`, error);
          // You might want to throw an error here or have a default placeholder image
        }
      }
    }
  }

  /**
   * Initializes or resets the game to a new state with the current settings.
   * This method is called by the constructor and resetGame.
   */
  private initializeNewGame(): void {
    this.gameState = 'playing';
    this.remainingNonMineCells = this.rows * this.cols - this.mineCount;
    this.board = this.initializeBoard();
    this.placeMines();
    this.calculateAdjacentMines();
    this.startTime = new Date(); // Record/Reset the start time
    this.endTime = null; // Reset the end time
    this.hitMineCoordinates = null; // Reset hit mine coordinates
  }

  /**
   * Initializes the game board with all cells set to default state (not a mine, not revealed, 0 adjacent mines).
   * @returns A 2D array of Cell objects representing the initialized board.
   */
  private initializeBoard(): Cell[][] {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        isMine: false,
        isRevealed: false,
        adjacentMines: 0,
      })));
  }

  /**
   * Randomly places the specified number of mines on the board.
   * Ensures that mines are placed only on cells that do not already contain a mine.
   */
  private placeMines(): void {
    let minesPlaced = 0;
    // Ensure board is clean of mines if this is called during a reset
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.board[r][c].isMine = false;
      }
    }

    while (minesPlaced < this.mineCount) {
      const row = Math.floor(Math.random() * this.rows);
      const col = Math.floor(Math.random() * this.cols);
      if (!this.board[row][col].isMine) {
        this.board[row][col].isMine = true;
        minesPlaced++;
      }
    }
  }

  /**
   * Calculates and stores the number of adjacent mines for each cell on the board that is not a mine itself.
   */
  private calculateAdjacentMines(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        this.board[row][col].adjacentMines = 0; // Reset for recalculation (e.g., on game reset)
        if (this.board[row][col].isMine) {
          continue; // Mines don't have an adjacent mine count in this context
        }

        let count = 0;
        for (const [dr, dc] of Minesweeper.DIRECTIONS) {
          const newRow = row + dr;
          const newCol = col + dc;
          if (this.isValidPosition(newRow, newCol) && this.board[newRow][newCol].isMine) {
            count++;
          }
        }
        this.board[row][col].adjacentMines = count;
      }
    }
  }

  /**
   * Checks if a given row and column are within the valid boundaries of the game board.
   * @param row The row index to check.
   * @param col The column index to check.
   * @returns True if the position is valid, false otherwise.
   */
  private isValidPosition(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  /**
   * Reveals all cells on the board. This is typically called when the game ends.
   */
  private revealAllCells(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.board[r][c].isRevealed = true;
      }
    }
  }

  /**
   * Handles the logic for revealing a cell at the given row and column.
   * If the cell is a mine, the game is lost.
   * If the cell has 0 adjacent mines, it triggers a recursive reveal of neighboring cells (flood fill).
   * Checks for win condition after a successful reveal.
   * @param row The row index of the cell to reveal.
   * @param col The column index of the cell to reveal.
   */
  public revealCell(row: number, col: number): void {
    // Ignore if game is over, position is invalid, or cell is already revealed
    if (this.gameState !== 'playing' || !this.isValidPosition(row, col) || this.board[row][col].isRevealed) {
      return;
    }

    const cell = this.board[row][col];
    cell.isRevealed = true;
    // Note: The time of the last move that *concludes* the game is captured by this.endTime.

    if (cell.isMine) {
      this.gameState = 'lost';
      this.endTime = new Date(); // Record game end time
      this.hitMineCoordinates = { row, col }; // Record which mine was hit
      this.revealAllCells(); // Reveal all cells as the game is lost
      return;
    }

    // If it's a non-mine cell, decrement the count of remaining non-mine cells to be revealed.
    this.remainingNonMineCells--;

    // If the revealed cell has no adjacent mines, recursively reveal its neighbors (flood fill).
    if (cell.adjacentMines === 0) {
      for (const [dr, dc] of Minesweeper.DIRECTIONS) {
        const newRow = row + dr;
        const newCol = col + dc;
        // The recursive call to revealCell itself handles isValidPosition and isRevealed checks.
        this.revealCell(newRow, newCol);
      }
    }

    // Check for win condition if all non-mine cells have been revealed.
    if (this.checkWinCondition()) {
      this.gameState = 'won';
      this.endTime = new Date(); // Record game end time
      this.revealAllCells(); // Reveal all cells as the game is won
    }
  }

  /**
   * Checks if the win condition has been met (all non-mine cells are revealed).
   * @returns True if the player has won, false otherwise.
   */
  private checkWinCondition(): boolean {
    return this.remainingNonMineCells === 0;
  }

  /**
   * Resets the game to its initial state with the same dimensions and mine count.
   * This method can only be called if the game is currently in a 'won' or 'lost' state.
   * @throws Error if the game is still 'playing'.
   */
  public resetGame(): void {
    if (this.gameState === 'playing') {
      throw new Error("Cannot reset the game while it is still in progress. Game must be 'won' or 'lost'.");
    }
    // Re-initialize the game using the original settings
    this.initializeNewGame();
  }

  /**
   * @returns The current state of the game board (2D array of Cells).
   */
  public getBoard(): Cell[][] {
    return this.board;
  }

  /**
   * @returns The current game state ('playing', 'won', or 'lost').
   */
  public getGameState(): GameState {
    return this.gameState;
  }

  /**
   * @returns The Date object representing when the game started.
   */
  public getStartTime(): Date {
    return this.startTime;
  }

  /**
   * @returns The Date object representing when the game ended, or null if the game is still in progress.
   *          This also serves as the time of the "last move" that concluded the game.
   */
  public getEndTime(): Date | null {
    return this.endTime;
  }

  /**
   * Gets the Uint8Array for the image corresponding to the cell's current state.
   * @param row The row of the cell.
   * @param col The column of the cell.
   * @returns The Uint8Array of the image, or undefined if no image is found for the state.
   */
  public getCellImage(row: number, col: number): Uint8Array | undefined {
    if (!this.isValidPosition(row, col)) {
      console.warn(`getCellImage: Invalid position (${row}, ${col})`);
      return undefined;
    }
    const cell = this.board[row][col];

    // If cell is not revealed (only possible if game is 'playing')
    if (!cell.isRevealed) {
      // During 'playing' state, all unrevealed cells are hidden buttons.
      // If the game has ended (won/lost), `revealAllCells` makes all cells `isRevealed = true`,
      // so this branch effectively only runs when gameState === 'playing'.
      return this.imageCache.get('cell_hidden');
    }

    // Cell is revealed (either by user action or by revealAllCells at game end)
    if (cell.isMine) {
      if (this.gameState === 'lost') {
        // If this specific mine was the one clicked that ended the game
        if (this.hitMineCoordinates && this.hitMineCoordinates.row === row && this.hitMineCoordinates.col === col) {
          return this.imageCache.get('mine_hit'); // e.g., mine-red.svg
        }
        // Other mines revealed after losing
        return this.imageCache.get('mine_normal'); // e.g., mine.svg
      }
      if (this.gameState === 'won') {
        // All mines are revealed peacefully when the game is won
        return this.imageCache.get('mine_normal'); // e.g., mine.svg
      }
      // Fallback: Should not happen if a mine is revealed while 'playing', as game would end.
      // But if it did, treat it as a hit mine.
      return this.imageCache.get('mine_hit');
    } else {
      // Revealed and not a mine
      const key = `cell_revealed_${cell.adjacentMines}` as ImageKey; // e.g., cell_revealed_0 for gray.svg, cell_revealed_1 for 1.svg
      return this.imageCache.get(key);
    }
  }

  /**
   * Gets the Uint8Array for the image corresponding to the current game status.
   * @returns The Uint8Array of the status image, or undefined if not found.
   */
  public getGameStatusImage(): Uint8Array | undefined {
    switch (this.gameState) {
      case 'playing':
        return this.imageCache.get('status_playing');
      case 'won':
        return this.imageCache.get('status_won');
      case 'lost':
        return this.imageCache.get('status_lost');
      default:
        return this.imageCache.get('status_playing'); // Fallback
    }
  }
}
